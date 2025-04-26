import os
import time
import logging
import psutil
import threading
import asyncio
from datetime import datetime
from flask import Flask, jsonify, request, redirect, g
from flask_cors import CORS
from werkzeug.middleware.proxy_fix import ProxyFix
from dotenv import load_dotenv
import atexit
import gc
import concurrent.futures
import signal
import resource

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Load environment variables from .env file
load_dotenv()

# Set resource limits to prevent OOM issues
def set_resource_limits():
    """Set resource limits to prevent memory issues"""
    # Get available memory to set reasonable limits
    try:
        mem_info = psutil.virtual_memory()
        total_mem_mb = mem_info.total / (1024 * 1024)

        # Set soft and hard memory limits (80% of total memory)
        memory_limit = int(total_mem_mb * 0.8 * 1024 * 1024)  # Convert to bytes
        resource.setrlimit(resource.RLIMIT_AS, (memory_limit, memory_limit))

        logger.info(f"Set memory limit to {memory_limit / (1024*1024*1024):.2f} GB")
    except Exception as e:
        logger.warning(f"Failed to set resource limits: {e}")

# Call this early to set limits
set_resource_limits()

# Initialize global thread pool for background tasks with adaptive sizing
cpu_count = os.cpu_count() or 4
thread_pool = concurrent.futures.ThreadPoolExecutor(
    max_workers=int(os.environ.get('THREAD_POOL_SIZE', cpu_count * 2)),
    thread_name_prefix="omnichat_worker"
)

# Create a separate thread pool for CPU-intensive tasks like document processing
cpu_thread_pool = concurrent.futures.ThreadPoolExecutor(
    max_workers=int(os.environ.get('CPU_POOL_SIZE', cpu_count)),
    thread_name_prefix="omnichat_cpu_worker"
)

# Initialize Flask app with performance optimizations
app = Flask(__name__)
app.config['JSON_SORT_KEYS'] = False  # Preserve JSON key order for faster serialization
app.config['JSONIFY_PRETTYPRINT_REGULAR'] = False  # Disable pretty printing in production
app.config['JSON_AS_ASCII'] = False  # Support Unicode characters in responses
app.config['PROPAGATE_EXCEPTIONS'] = True  # Better error handling
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024  # 50MB max request size

# Store app start time for uptime tracking
app.start_time = time.time()

# Configure CORS with appropriate settings
cors_origins = os.environ.get('CORS_ORIGINS', '*')
CORS(app, origins=cors_origins.split(',') if cors_origins != '*' else '*', supports_credentials=True)

# Fix for proper IP handling behind proxies
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)

# Import and initialize components lazily to improve startup time
from database.chat_store import ChatStore
from utils.document_processor import DocumentProcessor
from api_providers.provider_factory import get_available_providers, reset_provider_cache

# Create singleton instances with initialization in background threads
chat_store = None
document_processor = None
initialization_lock = threading.RLock()
initialization_complete = threading.Event()
shutdown_event = threading.Event()

def initialize_components():
    """Initialize application components in background"""
    global chat_store, document_processor

    try:
        logger.info("Initializing application components...")
        start_time = time.time()

        # Initialize components
        with initialization_lock:
            chat_store = ChatStore()
            document_processor = DocumentProcessor(
                cache_size=int(os.environ.get('DOC_CACHE_SIZE', 100))
                # Removed thread_pool parameter as it's not accepted by DocumentProcessor
            )

        # Warm up provider cache in background
        thread_pool.submit(get_available_providers)

        # Start memory monitoring if enabled
        if os.environ.get('ENABLE_MEMORY_MONITORING', 'false').lower() == 'true':
            start_memory_monitoring()

        initialization_complete.set()
        logger.info(f"Application initialization completed in {time.time() - start_time:.2f}s")
    except Exception as e:
        logger.error(f"Error during initialization: {e}", exc_info=True)
        # Set event anyway to prevent hanging, app will return errors
        initialization_complete.set()

# Memory monitoring for leak detection in development
def monitor_memory_usage():
    """Monitor memory usage periodically to detect leaks"""
    if shutdown_event.is_set():
        return

    process = psutil.Process(os.getpid())
    memory_mb = process.memory_info().rss / (1024 * 1024)

    # Log memory usage every minute
    logger.info(f"Memory usage: {memory_mb:.2f} MB")

    # Schedule next check in 60 seconds if not shutting down
    if not shutdown_event.is_set():
        threading.Timer(60, monitor_memory_usage).start()

def start_memory_monitoring():
    """Start background memory monitoring"""
    logger.info("Starting memory monitoring...")
    monitor_memory_usage()

# Signal handlers for graceful shutdown
def signal_handler(signum, frame):
    """Handle termination signals"""
    sig_name = signal.Signals(signum).name
    logger.info(f"Received signal {sig_name}, initiating graceful shutdown...")

    # Set shutdown event to stop background tasks
    shutdown_event.set()

    # Allow 10 seconds for cleanup and exit
    threading.Timer(10, force_exit).start()

    # Run cleanup now
    cleanup()

def force_exit():
    """Force exit if cleanup takes too long"""
    if threading.current_thread() == threading.main_thread():
        return

    logger.warning("Forcing exit after timeout...")
    os._exit(1)

# Register signal handlers
signal.signal(signal.SIGTERM, signal_handler)
signal.signal(signal.SIGINT, signal_handler)

# Start initialization in background
initialization_thread = threading.Thread(target=initialize_components, daemon=True)
initialization_thread.start()

# Import routes after app is created but before registering blueprints
from routes import api_routes, response_cache

# Register blueprints
app.register_blueprint(api_routes)

# Performance and monitoring middleware
@app.before_request
def before_request():
    # Check for shutdown in progress
    if shutdown_event.is_set():
        return jsonify({
            "status": "error",
            "message": "Server is shutting down, please try again later"
        }), 503

    # Wait for initialization to complete before handling requests
    if not initialization_complete.is_set():
        # If initialization is taking too long, set a timeout
        if not initialization_complete.wait(timeout=10.0):
            return jsonify({
                "status": "error",
                "message": "Server is still initializing, please try again shortly"
            }), 503

    # Store request start time for performance tracking
    g.start_time = time.time()
    g.request_id = request.headers.get('X-Request-ID', f"req-{int(time.time() * 1000)}")

    # Log incoming requests in development mode
    if app.debug:
        logger.debug(f"Request {g.request_id}: {request.method} {request.path}")

    # Check for rate limiting (simplified, consider using Flask-Limiter in production)
    if hasattr(g, 'rate_limited') and g.rate_limited:
        return jsonify({
            "status": "error",
            "message": "Rate limit exceeded, please try again later"
        }), 429

    # Check memory usage before handling large requests
    if request.content_length and request.content_length > 10 * 1024 * 1024:  # > 10MB
        process = psutil.Process(os.getpid())
        memory_mb = process.memory_info().rss / (1024 * 1024)
        memory_limit_mb = int(os.environ.get('MEMORY_LIMIT_MB', 0))

        if memory_limit_mb > 0 and memory_mb > memory_limit_mb * 0.9:
            # Memory usage approaching limit, reject large requests
            logger.warning(f"Rejecting large request due to high memory usage: {memory_mb:.2f}MB")
            return jsonify({
                "status": "error",
                "message": "Server is under high load, please try again later"
            }), 503

@app.after_request
def after_request(response):
    # Calculate request duration
    if hasattr(g, 'start_time'):
        duration = time.time() - g.start_time
    else:
        duration = 0

    # Add performance headers to response
    response.headers['X-Response-Time'] = f"{duration:.4f}s"

    if hasattr(g, 'request_id'):
        response.headers['X-Request-ID'] = g.request_id

    # Add security headers
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'DENY'
    response.headers['X-XSS-Protection'] = '1; mode=block'
    response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
    response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
    response.headers['Pragma'] = 'no-cache'

    # Log slow requests (>1s)
    if duration > 1.0 and hasattr(g, 'request_id'):
        logger.warning(f"Slow request {g.request_id}: {request.method} {request.path} took {duration:.4f}s")

    # Adaptive garbage collection based on request duration
    if duration > 5.0:
        def delayed_gc():
            if shutdown_event.is_set():
                return

            before_gc = psutil.Process(os.getpid()).memory_info().rss / 1024 / 1024
            gc.collect()
            after_gc = psutil.Process(os.getpid()).memory_info().rss / 1024 / 1024
            freed_mb = before_gc - after_gc

            if freed_mb > 1:  # Only log if we freed significant memory
                logger.info(f"GC freed {freed_mb:.2f}MB after long request")

        # Schedule GC in background to not block the response
        thread_pool.submit(delayed_gc)

    return response

# Error handlers
@app.errorhandler(404)
def not_found(error):
    return jsonify({"status": "error", "message": "Resource not found"}), 404

@app.errorhandler(405)
def method_not_allowed(error):
    return jsonify({"status": "error", "message": f"Method {request.method} not allowed"}), 405

@app.errorhandler(429)
def too_many_requests(error):
    return jsonify({
        "status": "error",
        "message": "Too many requests, please try again later"
    }), 429

@app.errorhandler(500)
def server_error(error):
    logger.error(f"Server error: {error}", exc_info=True)
    return jsonify({"status": "error", "message": "Internal server error"}), 500

@app.errorhandler(Exception)
def handle_exception(error):
    logger.error(f"Unhandled exception: {error}", exc_info=True)
    return jsonify({
        "status": "error",
        "message": "An unexpected error occurred",
        "error": str(error) if app.debug else "Internal server error"
    }), 500

# Routes
@app.route('/', methods=['GET'])
def root():
    return redirect('/api/health')

@app.route('/health', methods=['GET'])
def health_check():
    # Check for shutdown in progress
    if shutdown_event.is_set():
        return jsonify({
            "status": "shutting_down",
            "message": "OmniChat API is shutting down"
        }), 503

    # Ensure components are initialized
    if not initialization_complete.is_set():
        status = "initializing"
        message = "OmniChat API is starting up"
    else:
        status = "ok"
        message = "OmniChat API is running"

    # Gather system health information
    uptime = time.time() - app.start_time
    memory_usage = psutil.Process(os.getpid()).memory_info().rss / 1024 / 1024  # MB

    # Get thread pools status
    thread_pool_active = thread_pool._work_queue.qsize()
    cpu_pool_active = cpu_thread_pool._work_queue.qsize()

    # Get memory usage percentage
    memory_percent = psutil.virtual_memory().percent

    stats = {
        "status": status,
        "message": message,
        "timestamp": datetime.now().isoformat(),
        "uptime_seconds": uptime,
        "memory_usage_mb": round(memory_usage, 2),
        "memory_percent": round(memory_percent, 2),
        "chat_count": chat_store.get_chat_count() if chat_store else 0,
        "document_count": len(document_processor.list_documents()) if document_processor else 0,
        "providers": len(get_available_providers()),
        "thread_pool_active": thread_pool_active,
        "cpu_pool_active": cpu_pool_active,
        "version": os.environ.get("APP_VERSION", "dev"),
    }
    return jsonify(stats)

@app.route('/metrics', methods=['GET'])
def metrics():
    """Endpoint for monitoring systems to collect application metrics"""
    metrics_key = os.environ.get('METRICS_API_KEY')

    # Verify API key if configured
    if metrics_key and request.headers.get('X-API-Key') != metrics_key:
        return jsonify({"status": "error", "message": "Unauthorized"}), 401

    # Check for shutdown in progress
    if shutdown_event.is_set():
        return jsonify({
            "status": "shutting_down",
            "message": "OmniChat API is shutting down"
        }), 503

    # Ensure components are initialized
    if not initialization_complete.is_set():
        return jsonify({
            "status": "initializing",
            "message": "OmniChat API is starting up"
        })

    # Gather system info
    process = psutil.Process(os.getpid())
    uptime = time.time() - app.start_time

    # Get memory details
    mem_info = psutil.virtual_memory()
    sys_mem_used_percent = mem_info.percent
    proc_mem_percent = process.memory_percent()

    # Get thread pools status
    thread_pool_active = thread_pool._work_queue.qsize()
    cpu_pool_active = cpu_thread_pool._work_queue.qsize()
    thread_pool_threads = len([t for t in threading.enumerate() if t.name.startswith("omnichat_worker")])
    cpu_pool_threads = len([t for t in threading.enumerate() if t.name.startswith("omnichat_cpu_worker")])

    # Gather detailed system metrics
    metrics = {
        "timestamp": datetime.now().isoformat(),
        "system": {
            "uptime_seconds": uptime,
            "version": os.environ.get("APP_VERSION", "dev"),
            "cpu_percent": process.cpu_percent(),
            "memory_usage_mb": process.memory_info().rss / 1024 / 1024,
            "memory_percent": proc_mem_percent,
            "system_memory_percent": sys_mem_used_percent,
            "thread_count": process.num_threads(),
            "python_threads": len(threading.enumerate()),
            "open_files": len(process.open_files()),
            "connections": len(process.connections()),
            "file_descriptors": process.num_fds() if hasattr(process, 'num_fds') else None,
        },
        "providers": {
            "available": len(get_available_providers()),
            "providers": list(get_available_providers().keys()),
            "models_count": sum(len(p.get('models', [])) for p in get_available_providers().values())
        },
        "storage": {
            "chats_count": chat_store.get_chat_count(),
            "documents_count": len(document_processor.list_documents()),
            "chat_size_mb": round(chat_store.get_storage_size() / (1024*1024), 2) if hasattr(chat_store, 'get_storage_size') else None,
            "document_size_mb": round(document_processor.get_storage_size() / (1024*1024), 2) if hasattr(document_processor, 'get_storage_size') else None,
        },
        "routes": {
            "route_count": len(app.url_map._rules),
            "endpoints": [rule.endpoint for rule in app.url_map.iter_rules()]
        },
        "caches": {
            "response_cache_size": len(response_cache),
            "response_cache_hits": response_cache.get('hits', 0),
            "response_cache_misses": response_cache.get('misses', 0),
            "document_cache_size": len(document_processor.metadata_cache) if hasattr(document_processor, 'metadata_cache') else 0,
        },
        "thread_pools": {
            "main_pool": {
                "size": thread_pool._max_workers,
                "active": thread_pool_active,
                "threads": thread_pool_threads,
            },
            "cpu_pool": {
                "size": cpu_thread_pool._max_workers,
                "active": cpu_pool_active,
                "threads": cpu_pool_threads,
            }
        },
        "gc": {
            "garbage": len(gc.garbage),
            "collection_counts": gc.get_count(),
            "thresholds": gc.get_threshold(),
        }
    }
    return jsonify(metrics)

@app.route('/maintenance/gc', methods=['POST'])
def trigger_gc():
    """Trigger garbage collection to free memory"""
    metrics_key = os.environ.get('METRICS_API_KEY')

    # Verify API key if configured
    if metrics_key and request.headers.get('X-API-Key') != metrics_key:
        return jsonify({"status": "error", "message": "Unauthorized"}), 401

    # Memory before GC
    before = psutil.Process(os.getpid()).memory_info().rss / 1024 / 1024

    # Collect GC metrics before
    gc_stats_before = {
        "garbage": len(gc.garbage),
        "collection_counts": gc.get_count(),
    }

    # Perform full garbage collection
    gc.collect(2)  # Force collection of all generations

    # Memory after GC
    after = psutil.Process(os.getpid()).memory_info().rss / 1024 / 1024

    # Collect GC metrics after
    gc_stats_after = {
        "garbage": len(gc.garbage),
        "collection_counts": gc.get_count(),
    }

    return jsonify({
        "status": "success",
        "message": "Garbage collection performed",
        "memory_before_mb": round(before, 2),
        "memory_after_mb": round(after, 2),
        "memory_freed_mb": round(before - after, 2),
        "gc_stats_before": gc_stats_before,
        "gc_stats_after": gc_stats_after
    })

@app.route('/maintenance/clear-cache', methods=['POST'])
def clear_cache():
    """Clear all application caches"""
    metrics_key = os.environ.get('METRICS_API_KEY')

    # Verify API key if configured
    if metrics_key and request.headers.get('X-API-Key') != metrics_key:
        return jsonify({"status": "error", "message": "Unauthorized"}), 401

    # Ensure components are initialized
    if not initialization_complete.is_set():
        return jsonify({
            "status": "error",
            "message": "Application is still initializing"
        }), 503

    # Gather cache sizes before clearing
    cache_stats_before = {
        "provider_cache": len(get_available_providers()),
        "chat_cache": chat_store.get_cache_size() if hasattr(chat_store, 'get_cache_size') else 0,
        "document_cache": len(document_processor.metadata_cache) if hasattr(document_processor, 'metadata_cache') else 0,
        "response_cache": len(response_cache)
    }

    # Reset provider cache
    reset_provider_cache()

    # Clear other caches
    chat_store.clear_cache()
    document_processor.clear_cache()

    # Clear API response cache from routes.py
    response_cache.clear()

    # Gather cache sizes after clearing
    cache_stats_after = {
        "provider_cache": len(get_available_providers()),
        "chat_cache": chat_store.get_cache_size() if hasattr(chat_store, 'get_cache_size') else 0,
        "document_cache": len(document_processor.metadata_cache) if hasattr(document_processor, 'metadata_cache') else 0,
        "response_cache": len(response_cache)
    }

    # Perform garbage collection to reclaim memory
    gc.collect()

    return jsonify({
        "status": "success",
        "message": "All caches cleared successfully",
        "cache_stats_before": cache_stats_before,
        "cache_stats_after": cache_stats_after
    })

@app.route('/maintenance/purge-old-chats', methods=['POST'])
def purge_old_chats():
    """Purge old chat history to free up storage"""
    metrics_key = os.environ.get('METRICS_API_KEY')

    # Verify API key if configured
    if metrics_key and request.headers.get('X-API-Key') != metrics_key:
        return jsonify({"status": "error", "message": "Unauthorized"}), 401

    # Ensure components are initialized
    if not initialization_complete.is_set():
        return jsonify({
            "status": "error",
            "message": "Application is still initializing"
        }), 503

    # Get purge parameters
    data = request.json or {}
    older_than_days = data.get('older_than_days', 30)

    # Count chats before purge
    chats_before = chat_store.get_chat_count()

    # Perform purge in background
    def do_purge():
        try:
            purged = chat_store.purge_old_chats(older_than_days)
            logger.info(f"Purged {purged} chats older than {older_than_days} days")
            return purged
        except Exception as e:
            logger.error(f"Error during chat purge: {e}")
            return 0

    # Submit purge job
    future = thread_pool.submit(do_purge)
    purged = future.result()

    # Count chats after purge
    chats_after = chat_store.get_chat_count()

    return jsonify({
        "status": "success",
        "message": f"Purged {purged} chats older than {older_than_days} days",
        "chats_before": chats_before,
        "chats_after": chats_after,
        "purged_count": purged
    })

# Graceful shutdown handler
def cleanup():
    """Perform cleanup before shutdown"""
    if hasattr(cleanup, 'already_called') and cleanup.already_called:
        return

    cleanup.already_called = True
    logger.info("Application shutting down, performing cleanup...")

    # Signal background tasks to stop
    shutdown_event.set()

    # Shutdown thread pools gracefully
    logger.info("Shutting down thread pools...")

    for pool, name in [(thread_pool, "main"), (cpu_thread_pool, "CPU")]:
        try:
            logger.info(f"Shutting down {name} thread pool...")
            pool.shutdown(wait=False)  # Don't wait to avoid hanging

            # Wait up to 5 seconds for critical tasks
            for _ in range(50):  # 50 * 0.1 = 5 seconds
                if pool._work_queue.qsize() == 0:
                    break
                time.sleep(0.1)
        except Exception as e:
            logger.error(f"Error shutting down {name} thread pool: {e}")

    # Clear any caches to release memory
    if initialization_complete.is_set():
        logger.info("Clearing application caches...")
        try:
            reset_provider_cache()

            if chat_store:
                chat_store.clear_cache()
                # Flush pending writes
                if hasattr(chat_store, 'flush'):
                    chat_store.flush()

            if document_processor:
                document_processor.clear_cache()
                # Flush pending operations
                if hasattr(document_processor, 'flush'):
                    document_processor.flush()
        except Exception as e:
            logger.error(f"Error during cache clearing: {e}")

    # Force garbage collection before shutdown
    logger.info("Performing final garbage collection...")
    gc.collect()

    logger.info("Cleanup complete")

# Register cleanup function
atexit.register(cleanup)

if __name__ == '__main__':
    # Get configuration from environment
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('FLASK_ENV') == 'development'

    # Optimize for production
    threaded = os.environ.get('FLASK_THREADED', 'true').lower() == 'true'
    workers = int(os.environ.get('FLASK_WORKERS', 1))

    # Log startup
    logger.info(f"Starting OmniChat API on port {port} (debug: {debug}, threaded: {threaded})")
    logger.info(f"Server process ID: {os.getpid()}")

    # Wait for background initialization to complete
    if not debug:
        # In production, continue starting up even if initialization is still ongoing
        logger.info("Continuing startup while background initialization completes...")
    else:
        # In development, wait for initialization to complete before starting server
        logger.info("Waiting for initialization to complete...")
        initialization_complete.wait(timeout=30.0)

        # Log available providers
        providers = get_available_providers()
        logger.info(f"Available AI providers: {', '.join(providers.keys())}")

    # Start server
    app.run(debug=debug, host='0.0.0.0', port=port, threaded=threaded)
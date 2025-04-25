import { NextResponse } from 'next/server';

export async function HEAD() {
  try {
    // Try to reach the backend API
    const backendResponse = await fetch('http://localhost:5000/health', {
      method: 'HEAD',
      // Short timeout to avoid hanging requests
      signal: AbortSignal.timeout(1500)
    });
    
    if (backendResponse.ok) {
      return new NextResponse(null, { status: 200 });
    } else {
      throw new Error(`Backend responded with ${backendResponse.status}`);
    }
  } catch (error) {
    console.error('Backend health check failed:', error);
    return new NextResponse(null, { status: 503 });
  }
}

export async function GET() {
  try {
    // Try to reach the backend API
    const backendResponse = await fetch('http://localhost:5000/health');
    
    if (backendResponse.ok) {
      const data = await backendResponse.json();
      return NextResponse.json({ 
        status: 'online',
        backend: data,
        message: 'Backend API is available' 
      });
    } else {
      throw new Error(`Backend responded with ${backendResponse.status}`);
    }
  } catch (error) {
    console.error('Backend health check failed:', error);
    return NextResponse.json({ 
      status: 'offline',
      message: 'Backend API is unavailable, using fallback data',
      error: error instanceof Error ? error.message : String(error)
    }, { status: 200 }); // Still return 200 to indicate the API itself is working
  }
} 
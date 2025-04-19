from fastapi import APIRouter, HTTPException, Depends
from typing import List, Dict, Optional
from pydantic import BaseModel
from datetime import datetime, timedelta
import random

router = APIRouter(
    prefix="/analytics",
    tags=["analytics"],
    responses={404: {"description": "Not found"}},
)

class UsageStat(BaseModel):
    provider: str
    model: str
    count: int
    tokens_in: int
    tokens_out: int
    cost: float
    avg_response_time: float

class ProviderUsage(BaseModel):
    provider: str
    count: int
    cost: float
    models: Dict[str, int]

class TimeframeStats(BaseModel):
    timeframe: str
    total_conversations: int
    total_messages: int
    provider_usage: List[ProviderUsage]
    total_cost: float

# Generate mock data for analytics
def generate_mock_usage(days: int = 30):
    providers = ["openai", "anthropic", "google", "cohere", "groq"]
    models = {
        "openai": ["gpt-4o", "gpt-4", "dall-e-3"],
        "anthropic": ["claude-3-opus", "claude-3-sonnet"],
        "google": ["gemini-pro", "gemini-pro-vision"],
        "cohere": ["command-r"],
        "groq": ["llama3-70b-8192", "mixtral-8x7b-32768"]
    }
    
    # Generate random usage statistics for each provider and model
    usage_stats = []
    
    for provider in providers:
        for model in models[provider]:
            count = random.randint(10, 100)
            tokens_in = count * random.randint(100, 500)
            tokens_out = count * random.randint(200, 1000)
            
            # Calculate mock cost based on provider and tokens
            if provider == "openai":
                cost = tokens_in * 0.00001 + tokens_out * 0.00002
            elif provider == "anthropic":
                cost = tokens_in * 0.000008 + tokens_out * 0.000016
            else:
                cost = tokens_in * 0.000005 + tokens_out * 0.00001
            
            usage_stats.append(
                UsageStat(
                    provider=provider,
                    model=model,
                    count=count,
                    tokens_in=tokens_in,
                    tokens_out=tokens_out,
                    cost=round(cost, 4),
                    avg_response_time=random.uniform(0.5, 2.5)
                )
            )
    
    return usage_stats

# Generate provider usage summary
def generate_provider_usage(usage_stats: List[UsageStat]):
    provider_usage = {}
    
    for stat in usage_stats:
        if stat.provider not in provider_usage:
            provider_usage[stat.provider] = {
                "provider": stat.provider,
                "count": 0,
                "cost": 0,
                "models": {}
            }
        
        provider_usage[stat.provider]["count"] += stat.count
        provider_usage[stat.provider]["cost"] += stat.cost
        
        if stat.model not in provider_usage[stat.provider]["models"]:
            provider_usage[stat.provider]["models"][stat.model] = 0
        
        provider_usage[stat.provider]["models"][stat.model] += stat.count
    
    return [ProviderUsage(**data) for data in provider_usage.values()]

@router.get("/usage", response_model=List[UsageStat])
async def get_usage_stats(
    timeframe: str = "month",
    provider: Optional[str] = None
):
    # Generate mock usage data
    usage_stats = generate_mock_usage()
    
    # Filter by provider if specified
    if provider:
        usage_stats = [stat for stat in usage_stats if stat.provider == provider]
    
    return usage_stats

@router.get("/summary", response_model=TimeframeStats)
async def get_usage_summary(timeframe: str = "month"):
    # Generate mock usage data
    usage_stats = generate_mock_usage()
    
    # Calculate summary statistics
    total_conversations = random.randint(50, 200)
    total_messages = sum(stat.count for stat in usage_stats)
    total_cost = sum(stat.cost for stat in usage_stats)
    provider_usage = generate_provider_usage(usage_stats)
    
    return TimeframeStats(
        timeframe=timeframe,
        total_conversations=total_conversations,
        total_messages=total_messages,
        provider_usage=provider_usage,
        total_cost=round(total_cost, 2)
    )

@router.get("/cost-breakdown")
async def get_cost_breakdown(timeframe: str = "month"):
    # Generate mock usage data
    usage_stats = generate_mock_usage()
    
    # Group costs by provider
    costs_by_provider = {}
    for stat in usage_stats:
        if stat.provider not in costs_by_provider:
            costs_by_provider[stat.provider] = 0
        costs_by_provider[stat.provider] += stat.cost
    
    return {
        "timeframe": timeframe,
        "breakdown": costs_by_provider,
        "total": sum(costs_by_provider.values())
    } 
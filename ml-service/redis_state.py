import os
import redis

class RedisState:
    def __init__(self):
        redis_url = os.getenv("REDIS_URL")
        if redis_url:
            self.client = redis.from_url(redis_url, decode_responses=True)
        else:
            self.client = redis.Redis(
                host=os.getenv("REDIS_HOST", "localhost"),
                port=int(os.getenv("REDIS_PORT", 6379)),
                decode_responses=True
            )

    def get_attack_intensity(self):
        value = self.client.get("attack_intensity")
        return float(value) if value else 0.0

    def set_attack_intensity(self, value):
        self.client.set("attack_intensity", value)

    def get_user_trust(self, user_id):
        trust = self.client.get(f"user_trust:{user_id}")
        return int(trust) if trust else 0

    def set_user_trust(self, user_id, trust):
        self.client.set(f"user_trust:{user_id}", trust)
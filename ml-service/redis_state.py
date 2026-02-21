import os
import redis


class RedisState:

    def __init__(self):
        # Reads from environment so it works both locally and in Docker
        # Local:  REDIS_HOST=localhost (default)
        # Docker: REDIS_HOST=redis     (service name in docker-compose)
        self.client = redis.Redis(
            host=os.getenv("REDIS_HOST", "localhost"),
            port=int(os.getenv("REDIS_PORT", 6379)),
            decode_responses=True
        )

    # -----------------------
    # GLOBAL ATTACK INTENSITY
    # -----------------------
    def get_attack_intensity(self):
        value = self.client.get("attack_intensity")
        return float(value) if value else 0.0

    def set_attack_intensity(self, value):
        self.client.set("attack_intensity", value)

    # -----------------------
    # USER TRUST
    # -----------------------
    def get_user_trust(self, user_id):
        trust = self.client.get(f"user_trust:{user_id}")
        return int(trust) if trust else 0

    def set_user_trust(self, user_id, trust):
        self.client.set(f"user_trust:{user_id}", trust)
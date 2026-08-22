import requests

from config import BACKEND_URL


class DayflowClient:
    def __init__(self, access_token):
        self.access_token = access_token

    @property
    def headers(self):
        return {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json",
        }

    def _get(self, endpoint):
        response = requests.get(
            f"{BACKEND_URL}{endpoint}",
            headers=self.headers,
            timeout=10,
        )

        response.raise_for_status()
        return response.json()

    def get_profile(self):
        return self._get("/v1/employees/me")

    def get_attendance(self):
        return self._get("/v1/attendance/me")

    def get_leave_balance(self):
        return self._get("/v1/leaves/me/balance")

    def get_leaves(self):
        return self._get("/v1/leaves/me")

    def get_payroll(self):
        return self._get("/v1/payroll/me")

    def get_notifications(self):
        return self._get("/v1/notifications/me")
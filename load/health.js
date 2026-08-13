import http from "k6/http";
import { check, sleep } from "k6";
export const options = { vus: 20, duration: "30s", thresholds: { http_req_duration: ["p(95)<300"], http_req_failed: ["rate<0.01"] } };
export default function () { const response = http.get(`${__ENV.BASE_URL ?? "http://localhost:3001"}/api/health/ready`); check(response, { ready: (result) => result.status === 200 }); sleep(1); }

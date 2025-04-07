import pandas as pd
from datetime import datetime
import os

# Define sample data for tasks_log
task_log = pd.DataFrame([
    {"Date": datetime(2025, 4, 1), "Task": "Build ML API Endpoint", "Hours": 5, "Rate": 50, "Client": "Project X"},
    {"Date": datetime(2025, 4, 2), "Task": "Train Transformer Model", "Hours": 3, "Rate": 50, "Client": "Project X"},
    {"Date": datetime(2025, 4, 3), "Task": "Create Dashboard", "Hours": 4, "Rate": 60, "Client": "Project X"},
    {"Date": datetime(2025, 4, 1), "Task": "Client Onboarding", "Hours": 2, "Rate": 45, "Client": "Client Y"},
    {"Date": datetime(2025, 4, 4), "Task": "Fix Production Bugs", "Hours": 6, "Rate": 55, "Client": "Client Y"}
])

# File path
file_path = "tasks_log.xlsx"
task_log.to_excel(file_path, index=False)

file_path

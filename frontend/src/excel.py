# This script requires Streamlit. Run this in your local Python environment with `pip install streamlit`.
# Execute using `streamlit run lifestyle_app.py`

try:
    import streamlit as st
    import pandas as pd
    import os
    import plotly.express as px
    from datetime import date
except ModuleNotFoundError as e:
    raise ImportError("Missing required packages. Please install using `pip install streamlit pandas plotly openpyxl`.\n" + str(e))

# File path
FILE_PATH = "Lifestyle_Dashboard_AI_Engineer.xlsx"

# Ensure file exists
if not os.path.exists(FILE_PATH):
    raise FileNotFoundError("Excel file not found. Please ensure 'Lifestyle_Dashboard_AI_Engineer.xlsx' exists in the script directory.")

# Load sheets
daily_df = pd.read_excel(FILE_PATH, sheet_name="Daily_Tracker")
finance_df = pd.read_excel(FILE_PATH, sheet_name="Finance_Tracker")
learning_df = pd.read_excel(FILE_PATH, sheet_name="Learning_Tracker")
fitness_df = pd.read_excel(FILE_PATH, sheet_name="Fitness_Tracker")
weekly_df = pd.read_excel(FILE_PATH, sheet_name="Weekly_Review")

st.set_page_config(page_title="Lifestyle Dashboard", layout="wide")
st.title("🧠 Optimized Lifestyle Tracker")

# Tabs
tabs = st.tabs(["📅 Daily Tracker", "💰 Finance Tracker", "📚 Learning Tracker", "💪 Fitness Tracker", "🧾 Weekly Review"])

# === DAILY TRACKER ===
with tabs[0]:
    st.subheader("Daily Entry")
    with st.form("daily_form"):
        col1, col2, col3 = st.columns(3)
        with col1:
            sleep = st.number_input("Sleep Hours", 0.0, 12.0, step=0.5)
            deep_work = st.number_input("Deep Work Hours", 0.0, 8.0, step=0.5)
        with col2:
            mood = st.slider("Mood (1-5)", 1, 5)
            meal = st.slider("Meal Quality (1-5)", 1, 5)
        with col3:
            learning = st.number_input("Learning Time (mins)", 0, 300, step=10)
            exercise = st.selectbox("Exercise Done?", ["Yes", "No"])
        notes = st.text_area("Notes")
        if st.form_submit_button("Save Entry"):
            new_entry = pd.DataFrame([[date.today(), sleep, mood, exercise, deep_work, meal, learning, notes]],
                columns=daily_df.columns)
            daily_df = pd.concat([daily_df, new_entry], ignore_index=True)
            with pd.ExcelWriter(FILE_PATH, engine="openpyxl", mode="a", if_sheet_exists="replace") as writer:
                daily_df.to_excel(writer, index=False, sheet_name="Daily_Tracker")
            st.success("Daily entry saved.")

    st.subheader("Visualization")
    if not daily_df.empty:
        fig = px.bar(daily_df, x="Date", y=["Sleep Hours", "Deep Work Hours"], barmode="group", title="Sleep vs Deep Work")
        st.plotly_chart(fig, use_container_width=True)

# === FINANCE TRACKER ===
with tabs[1]:
    st.subheader("Finance Entry")
    with st.form("finance_form"):
        date_input = st.date_input("Date", value=date.today())
        ftype = st.selectbox("Type", ["Income", "Expense"])
        category = st.text_input("Category")
        amount = st.number_input("Amount", 0.0, 100000.0, step=100.0)
        desc = st.text_input("Description")
        mode = st.selectbox("Mode", ["Cash", "UPI", "Card", "Bank"])
        if st.form_submit_button("Save Finance Entry"):
            new_fin = pd.DataFrame([[date_input, ftype, category, amount, desc, mode]], columns=finance_df.columns)
            finance_df = pd.concat([finance_df, new_fin], ignore_index=True)
            with pd.ExcelWriter(FILE_PATH, engine="openpyxl", mode="a", if_sheet_exists="replace") as writer:
                finance_df.to_excel(writer, index=False, sheet_name="Finance_Tracker")
            st.success("Finance entry saved.")

    st.subheader("Expense Breakdown")
    expense_df = finance_df[finance_df['Type'] == 'Expense']
    if not expense_df.empty:
        fig = px.pie(expense_df, names="Category", values="Amount", title="Expense Categories")
        st.plotly_chart(fig, use_container_width=True)

# === LEARNING TRACKER ===
with tabs[2]:
    st.subheader("Learning Log")
    with st.form("learning_form"):
        topic = st.text_input("Topic")
        ltype = st.selectbox("Type", ["Course", "Book", "Video", "Project"])
        platform = st.text_input("Platform")
        hours = st.number_input("Hours Spent", 0.0, 100.0, step=0.5)
        progress = st.slider("Progress (%)", 0, 100)
        notes = st.text_area("Notes")
        if st.form_submit_button("Save Learning Log"):
            new_learn = pd.DataFrame([[topic, ltype, platform, hours, progress, notes]], columns=learning_df.columns)
            learning_df = pd.concat([learning_df, new_learn], ignore_index=True)
            with pd.ExcelWriter(FILE_PATH, engine="openpyxl", mode="a", if_sheet_exists="replace") as writer:
                learning_df.to_excel(writer, index=False, sheet_name="Learning_Tracker")
            st.success("Learning entry saved.")

    st.subheader("Learning Progress")
    if not learning_df.empty:
        fig = px.bar(learning_df, x="Topic", y="Progress", color="Platform", title="Learning Progress by Topic")
        st.plotly_chart(fig, use_container_width=True)

# === FITNESS TRACKER ===
with tabs[3]:
    st.subheader("Fitness Log")
    with st.form("fitness_form"):
        date_input = st.date_input("Date", value=date.today())
        weight = st.number_input("Weight (kg)", 30.0, 150.0, step=0.5)
        steps = st.number_input("Steps", 0, 30000, step=100)
        workout = st.selectbox("Workout Done?", ["Yes", "No"])
        calories = st.number_input("Calories Burnt", 0, 2000, step=50)
        sleep_score = st.slider("Sleep Score", 0, 100)
        if st.form_submit_button("Save Fitness Log"):
            new_fit = pd.DataFrame([[date_input, weight, steps, workout, calories, sleep_score]], columns=fitness_df.columns)
            fitness_df = pd.concat([fitness_df, new_fit], ignore_index=True)
            with pd.ExcelWriter(FILE_PATH, engine="openpyxl", mode="a", if_sheet_exists="replace") as writer:
                fitness_df.to_excel(writer, index=False, sheet_name="Fitness_Tracker")
            st.success("Fitness entry saved.")

    st.subheader("Fitness Trends")
    if not fitness_df.empty:
        fig = px.line(fitness_df, x="Date", y=["Weight", "Sleep Score"], title="Weight and Sleep Score Over Time")
        st.plotly_chart(fig, use_container_width=True)

# === WEEKLY REVIEW ===
with tabs[4]:
    st.subheader("Weekly Reflection")
    with st.form("weekly_form"):
        week = st.text_input("Week Range (e.g. Apr 1–7)")
        wins = st.text_area("Wins")
        struggles = st.text_area("Struggles")
        plan = st.text_area("Plan for Next Week")
        if st.form_submit_button("Save Weekly Review"):
            new_week = pd.DataFrame([[week, wins, struggles, plan]], columns=weekly_df.columns)
            weekly_df = pd.concat([weekly_df, new_week], ignore_index=True)
            with pd.ExcelWriter(FILE_PATH, engine="openpyxl", mode="a", if_sheet_exists="replace") as writer:
                weekly_df.to_excel(writer, index=False, sheet_name="Weekly_Review")
            st.success("Weekly review saved.")

    st.subheader("Review Summary")
    if not weekly_df.empty:
        st.dataframe(weekly_df.tail(5))

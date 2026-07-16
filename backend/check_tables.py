import psycopg2

try:
    conn = psycopg2.connect(
        dbname="ai_interview_agent",
        user="postgres",
        password="admin",
        host="localhost",
        port="5432"
    )
    cursor = conn.cursor()
    cursor.execute("""
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
    """)
    tables = cursor.fetchall()
    print("Tables in Database:", tables)
    
    # Let's check columns of table 'admin' if it exists
    cursor.execute("""
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'admin'
    """)
    columns = cursor.fetchall()
    print("Columns in 'admin' table:", columns)
    
    cursor.close()
    conn.close()
except Exception as e:
    print("Error:", e)

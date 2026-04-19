import mysql.connector
from db import get_connection

def create_indexes():

    index_queries = [
        {
            "name": "idx_user_username",
            "query": "CREATE UNIQUE INDEX idx_user_username ON `user` (username);"
        },
        {
            "name": "idx_contests_visibility_start",
            "query": "CREATE INDEX idx_contests_visibility_start ON contests (visibility, start_time);"
        },
        {
            "name": "idx_contests_end_time",
            "query": "CREATE INDEX idx_contests_end_time ON contests (end_time);"
        },
        {
            "name": "idx_sub_contest_problem_time",
            "query": "CREATE INDEX idx_sub_contest_problem_time ON Submissions (contest_id, problem_id, submitted_at);"
        },
        {
            "name": "idx_testcases_problem_sample",
            "query": "CREATE INDEX idx_testcases_problem_sample ON testcases (problem_id, is_sample);"
        },
        {
            "name": "idx_cp_user_id",
            "query": "CREATE INDEX idx_cp_user_id ON contest_participants (user_id);"
        },
        {
            "name": "idx_cps_user_id",
            "query": "CREATE INDEX idx_cps_user_id ON contest_problem_scores (user_id);"
        }
    ]

    print("Connecting to the database...")
    try:
        connection = get_connection()
        cursor = connection.cursor()
        print("Connected successfully. Creating indexes...\n")

        for index in index_queries:
            try:
                print(f"Creating index: {index['name']}...")
                cursor.execute(index["query"])
                print(f"Successfully created {index['name']}")
            except mysql.connector.Error as err:
                # 1061 is the specific error code for 'Duplicate key name' (index already exists)
                if err.errno == 1061:
                    print(f"Index {index['name']} already exists. Skipping.")
                # 1062 is the specific error code for 'Duplicate entry' (unique index violation)
                elif err.errno == 1062:
                    print(f"Failed to create UNIQUE index {index['name']}. There are duplicate entries in your table that violate uniqueness: {err.msg}")
                else:
                    print(f"Error creating {index['name']}: {err.msg}")

        connection.commit()
        print("\nAll indexing operations completed.")
    
    except mysql.connector.Error as err:
        print(f"Database connection error: {err}")
    finally:
        if 'cursor' in locals() and cursor is not None:
            cursor.close()
        if 'connection' in locals() and connection.is_connected():
            connection.close()

if __name__ == "__main__":
    create_indexes()

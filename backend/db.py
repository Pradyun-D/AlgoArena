from rest_framework.permissions import NOT
import mysql.connector
import os
from dotenv import load_dotenv

load_dotenv()
ca_path = os.getenv('CA', r'certs/isrgrootx1.pem')
db_username = os.getenv('DB_USER', r'certs/isrgrootx1.pem')
db_pass = os.getenv('DB_PASS', r'certs/isrgrootx1.pem')


print("CA PATH:", ca_path)
print("DB USERNAME:", db_username)
print("DB PASSWORD:", db_pass)

config = {
    'host': 'gateway01.ap-southeast-1.prod.aws.tidbcloud.com',
    'port': 4000,
    'user': db_username,
    'password': db_pass,
    'database': 'test',
    'ssl_ca': ca_path,  
    'ssl_verify_cert': True,
   
}

def get_connection():
    return mysql.connector.connect(**config,use_pure=True)

connection = get_connection()
cursor = connection.cursor()

user_queries = [
    """
        CREATE TABLE IF NOT EXISTS roles(
            role_id INT AUTO_INCREMENT PRIMARY KEY,
            role_name VARCHAR(255) NOT NULL UNIQUE,
            description TEXT
        );
        CREATE TABLE IF NOT EXISTS user(
            user_id INT AUTO_INCREMENT PRIMARY KEY,
            uuid CHAR(36) UNIQUE,
            username VARCHAR(255) NOT NULL,
            email VARCHAR(255) UNIQUE,
            password_hash VARCHAR(255),
            role_id INT,
            status ENUM('active', 'suspended', 'banned') DEFAULT 'active',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            deleted_at TIMESTAMP NULL, 
            FOREIGN KEY(role_id) REFERENCES roles(role_id)
        );
        CREATE TABLE IF NOT EXISTS profile(
            profile_id INT AUTO_INCREMENT PRIMARY KEY,
            uuid CHAR(36) UNIQUE,
            user_id INT,
            full_name VARCHAR(500),
            bio VARCHAR(500),
            avatar_url VARCHAR(500),
            college VARCHAR(500),
            total_problems_solved INT DEFAULT 0, 
            FOREIGN KEY(user_id) REFERENCES user(user_id)
        );
    """
]

# add_uuid = [
#     """
#         ALTER TABLE user ADD COLUMN uuid CHAR(36);
#         ALTER TABLE user ADD UNIQUE(uuid);    
#         ALTER TABLE profile ADD COLUMN uuid CHAR(36);
#         ALTER TABLE profile ADD UNIQUE(uuid);
#     """
# ]

problem_queries = [
    """
        CREATE TABLE IF NOT EXISTS problems(
            problem_id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
            title VARCHAR(255) NOT NULL,
            slug VARCHAR(255) NOT NULL,
            description TEXT,
            difficulty ENUM('easy', 'medium', 'hard') DEFAULT 'easy',
            time_limit_ms INT,
            memory_limit_kb INT,
            visibility ENUM('public', 'private', 'contest_only') DEFAULT 'public',
            created_by INT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY(created_by) REFERENCES user(user_id)
        );
        ALTER TABLE problems ADD UNIQUE(problem_id);

        CREATE TABLE IF NOT EXISTS tags(
            tag_id INT AUTO_INCREMENT PRIMARY KEY, 
            name VARCHAR(255) UNIQUE
        );
        CREATE TABLE IF NOT EXISTS problem_tags(
            problem_id CHAR(36),
            tag_id INT,
            PRIMARY KEY(problem_id, tag_id),
            FOREIGN KEY(problem_id) REFERENCES problems(problem_id),
            FOREIGN KEY(tag_id) REFERENCES tags(tag_id)
        );
        CREATE TABLE IF NOT EXISTS editorials(
            editorial_id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
            problem_id CHAR(36),
            content TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY(problem_id) REFERENCES problems(problem_id)
        );
        ALTER TABLE editorials ADD UNIQUE(editorial_id);
    """
]

contest_queries = [
    """
        CREATE TABLE IF NOT EXISTS contests(
            contest_id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
            title VARCHAR(255) NOT NULL,
            description TEXT,
            start_time TIMESTAMP,
            end_time TIMESTAMP,
            visibility ENUM('public', 'private') DEFAULT 'public',
            created_by INT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY(created_by) REFERENCES user(user_id)
        );
        ALTER TABLE contests ADD UNIQUE(contest_id);
        CREATE TABLE IF NOT EXISTS contest_problems(
            contest_id CHAR(36),
            problem_id CHAR(36),
            max_score INT,
            PRIMARY KEY(contest_id, problem_id),
            FOREIGN KEY(contest_id) REFERENCES contests(contest_id),
            FOREIGN KEY(problem_id) REFERENCES problems(problem_id)
        );
        CREATE TABLE IF NOT EXISTS contest_participants(
            contest_id CHAR(36),
            user_id INT,
            problems_solved INT DEFAULT 0,
            current_score INT DEFAULT 0,
            time_penalty_ms INT DEFAULT 0,
            PRIMARY KEY(contest_id, user_id),
            FOREIGN KEY(contest_id) REFERENCES contests(contest_id),
            FOREIGN KEY(user_id) REFERENCES user(user_id)
        );
    """
]

exec_engine_queries = [
    """
        CREATE TABLE IF NOT EXISTS languages(
            language_id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(255) UNIQUE
        );
        CREATE TABLE IF NOT EXISTS testcases(
            testcase_id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
            problem_id CHAR(36),
            input TEXT,
            expected_output TEXT,
            is_sample BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY(problem_id) REFERENCES problems(problem_id)
        );
        ALTER TABLE testcases ADD UNIQUE(testcase_id);

        CREATE TABLE IF NOT EXISTS Submissions(
            submission_id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
            user_id INT,
            problem_id CHAR(36),
            contest_id CHAR(36),
            language_id INT,
            source_code TEXT,
            verdict ENUM('Pending', 'Accepted', 'Wrong Answer', 'Time Limit Exceeded', 'Runtime Error', 'Compilation Error', 'Memory Limit Exceeded'),
            status ENUM('In_Queue', 'Processing', 'Completed', 'System_Error'),
            max_execution_time_ms INT,
            max_memory_used_kb INT,
            submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES user(user_id),
            FOREIGN KEY(problem_id) REFERENCES problems(problem_id),
            FOREIGN KEY(contest_id) REFERENCES contests(contest_id),
            FOREIGN KEY(language_id) REFERENCES languages(language_id)
        );
        ALTER TABLE Submissions ADD UNIQUE(submission_id);

        CREATE TABLE IF NOT EXISTS SubmissionResults(
            result_id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
            submission_id CHAR(36),
            test_case_id CHAR(36),
            verdict ENUM('Passed', 'Failed', 'Time Limit Exceeded', 'Runtime Error', 'Compilation Error', 'Memory Limit Exceeded', 'Skipped'),
            execution_time_ms INT,
            memory_used_kb INT,
            FOREIGN KEY (submission_id) REFERENCES Submissions(submission_id),
            FOREIGN KEY (test_case_id) REFERENCES testcases(testcase_id)
        );
        ALTER TABLE SubmissionResults ADD UNIQUE(result_id);
    """

]

"""
for query in exec_engine_queries:
    cursor.execute(query)

connection.commit()
cursor.close()
connection.close()
"""
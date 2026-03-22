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
    return mysql.connector.connect(**config)

#Sample test
connection = get_connection()
cursor = connection.cursor()
cursor.execute("SELECT * FROM Friends")
rows = cursor.fetchall()
for row in rows:
    print(row)

cursor.close()
connection.close()
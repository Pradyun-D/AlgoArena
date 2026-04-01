from rest_framework import serializers
import mysql.connector
from ..db import config

class ContestSerializer(serializers.Serializer):
    
    # read only fields
    contest_id = serializers.UUIDField(read_only=True)
    created_at = serializers.DateTimeField(read_only=True)
    created_by = serializers.IntegerField(read_only=True) 

    # writable fields
    title = serializers.CharField(max_length=255)
    description = serializers.CharField(style={'base_template': 'textarea.html'})
    start_time = serializers.DateTimeField()
    end_time = serializers.DateTimeField()
    visibility = serializers.ChoiceField(choices=['Public', 'Private'])

 
    def validate(self, data):
        if len(data["title"])==0:
            raise serializers.ValidationError("Title must not be empty")      
        if data["start_time"]>=data["end_time"]:
            raise serializers.ValidationError("End time must occur after start time.")
        return data

 
    def create(self, validated_data):
       
        # 1. Generate UUID for the new contest
        import uuid
        new_id = str(uuid.uuid4())

        # 2. Connect to DB and Insert
        
     
        conn = mysql.connector.connect(host=config["host"], user=config["user"], password=config["password"], database=config["database"])
        cursor = conn.cursor()

        sql = """
            INSERT INTO contests 
            (contest_id, title, description, start_time, end_time, visibility, created_by) 
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """
        values = (
            new_id,
            validated_data['title'],
            validated_data['description'],
            validated_data['start_time'],
            validated_data['end_time'],
            validated_data['visibility'],
            validated_data['created_by'] 
        )
        
        cursor.execute(sql, values)
        conn.commit()
        
        # 3. Add the generated ID back to the data so the frontend can see it
        validated_data['contest_id'] = new_id
        
        cursor.close()
        conn.close()

        return validated_data
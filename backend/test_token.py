from app.utils.auth import create_access_token, SECRET_KEY, ALGORITHM
from jose import jwt, JWTError

try:
    token = create_access_token(data={"sub": "aleemman1234@gmail.com", "role": "Super Admin"})
    print("Token created:", token)
    payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    print("Payload decoded successfully:", payload)
except Exception as e:
    print("Error:", e)

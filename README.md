# BeatX Backend API Documentation

Base URL:
----------
https://beatx-api.onrender.com

---------------------------------------------
1. AUTHENTICATION & USER MANAGEMENT
---------------------------------------------

1.1 Signup
----------
POST /auth/signup

Request Body (JSON):
{
"email": "user@example.com",
"password": "yourpassword",
"name": "John Doe"      // optional, defaults to email prefix if omitted
}

Success Response (201):
{
"status": 1,
"message": "Signup successful. Please check your email to verify your account.",
"data": {
"access_token": "jwt_access_token",
"refresh_token": "jwt_refresh_token"
}
}

Error Responses:
- Email already registered:
  {
  "status": 0,
  "message": "Email already registered. Please login."
  }

- Validation or server errors:
  {
  "status": 0,
  "message": "Error message here"
  }

---------------------------------------------

1.2 Login
---------
POST /auth/login

Request Body (JSON):
{
"email": "user@example.com",
"password": "yourpassword"
}

Success Response (200):
{
"status": 1,
"message": "Login successful",
"data": {
"access_token": "jwt_access_token",
"refresh_token": "jwt_refresh_token"
}
}

Error Responses:
- Email not verified:
  {
  "status": 0,
  "message": "Please verify your email before logging in."
  }

- Invalid credentials or others:
  {
  "status": 0,
  "message": "Invalid login credentials"
  }

---------------------------------------------

1.3 Logout
----------
POST /auth/logout

Request Body (JSON):
{
"refresh_token": "your_refresh_token"
}

Success Response (200):
{
"status": 1,
"message": "Logout successful"
}

---------------------------------------------

1.4 Refresh Token
----------------
POST /auth/refresh

Request Body (JSON):
{
"refresh_token": "your_refresh_token"
}

Success Response (200):
{
"status": 1,
"message": "Token refreshed successfully",
"data": {
"access_token": "new_jwt_access_token"
}
}

---------------------------------------------
2. USER PROFILE
---------------------------------------------

2.1 Get Profile
---------------
GET /auth/profile

Headers:
Authorization: Bearer <access_token>

Success Response (200):
{
"status": 1,
"message": "Profile fetched successfully",
"data": {
"id": "user_uuid",
"email": "user@example.com",
"name": "John Doe"
}
}

Error Response:
{
"status": 0,
"message": "Unauthorized or profile not found"
}

---------------------------------------------

2.2 Update Profile
------------------
PUT /auth/profile

Headers:
Authorization: Bearer <access_token>

Request Body (JSON):
{
"name": "New Name"
}

Success Response (200):
{
"status": 1,
"message": "Profile updated successfully",
"data": {
"name": "New Name"
}
}

---------------------------------------------
3. PLAYLISTS
---------------------------------------------

3.1 Get All Playlists
---------------------
GET /playlists

Headers:
Authorization: Bearer <access_token>

Success Response (200):
{
"status": 1,
"message": "Playlists retrieved successfully",
"data": [
{
"id": "playlist_uuid",
"name": "My Playlist",
"description": "Optional description",
"created_at": "timestamp"
},
...
]
}

If no playlists:
{
"status": 0,
"message": "No playlists found",
"data": []
}

---------------------------------------------

3.2 Create Playlist
-------------------
POST /playlists

Headers:
Authorization: Bearer <access_token>

Request Body (JSON):
{
"name": "My Playlist",
"description": "Optional description"
}

Success Response (201):
{
"status": 1,
"message": "Playlist created successfully",
"data": {
"id": "playlist_uuid",
"name": "My Playlist",
"description": "Optional description",
"created_at": "timestamp"
}
}

Error Response if duplicate name:
{
"status": 0,
"message": "Playlist name already exists"
}

---------------------------------------------

3.3 Get Playlist Tracks
-----------------------
GET /playlists/:playlistId/tracks

Headers:
Authorization: Bearer <access_token>

Success Response (200):
{
"status": 1,
"message": "Playlist tracks retrieved successfully",
"data": [
{
"id": "track_uuid",
"title": "Track Title",
"artist": "Artist Name",
"album": "Album Name",
"duration": 214,
"file_key": "url_to_file",
"album_art_url": "url_to_album_art",
...
},
...
]
}

If no tracks:
{
"status": 0,
"message": "No tracks found in this playlist",
"data": []
}

---------------------------------------------

3.4 Toggle Track in Playlist
----------------------------
POST /playlists/:playlistId/tracks/toggle

Headers:
Authorization: Bearer <access_token>

Request Body (JSON):
{
"track_id": "track_uuid"
}

Success Response (200):
{
"status": 1,
"message": "Track added to playlist"  // or "Track removed from playlist"
}

Error Response:
{
"status": 0,
"message": "Error message"
}

---------------------------------------------
4. TRACKS
---------------------------------------------

4.1 Get All Tracks
------------------
GET /tracks

Headers:
Authorization: Bearer <access_token>

Success Response (200):
{
"status": 1,
"message": "Tracks retrieved successfully",
"data": [
{
"id": "track_uuid",
"title": "Track Title",
"artist": "Artist Name",
"album": "Album Name",
"duration": 214,
"file_key": "url_to_file",
"album_art_url": "url_to_album_art",
...
},
...
]
}

If no tracks:
{
"status": 0,
"message": "No tracks found",
"data": []
}

---------------------------------------------

Notes:
------
- Always send access tokens in headers for protected routes:
  Authorization: Bearer <access_token>

- Response structure:
    - On success: status = 1
    - On no data found: status = 0 with empty array or object
    - On error: status = 0 with error message

- Tokens expire per your configured expiry time (default 1 day). Use refresh token API to get new access tokens.

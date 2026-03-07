# MediVault - Backend

Express backend for **MediVault - Digital Medical History Platform** using MongoDB Atlas and Mongoose.

## Tech Stack

- Node.js
- Express.js
- MongoDB Atlas + Mongoose
- JWT authentication
- Multer file uploads
- bcrypt password hashing
- dotenv
- CORS

## Project Structure

```text
backend/
|- server.js
|- config/
|  |- db.js
|- models/
|  |- User.js
|  |- Record.js
|- routes/
|  |- authRoutes.js
|  |- recordRoutes.js
|- controllers/
|  |- authController.js
|  |- recordController.js
|- middleware/
|  |- authMiddleware.js
|- uploads/
|- .env
```

## Environment Variables

Set `.env`:

```env
PORT=5000
JWT_SECRET=your_secret_key
MONGODB_URI=mongodb+srv://medivaultUser:<PASSWORD>@medivault-cluster.1vmjzrr.mongodb.net/?appName=medivault-cluster
MONGODB_DB_NAME=medivault
```

`config/db.js` also accepts `MONGO_URI` and `MONGO_DB_NAME` if you prefer those names.

## Install and Run

```bash
npm install
node server.js
```

## API Endpoints

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/records/upload` (Protected, `multipart/form-data`: `patientId`, `title`, `description`, `file`)
- `GET /api/records/file/:filename/preview` (Protected)
- `GET /api/records/file/:filename/download` (Protected)
- `GET /api/records/vault-status` (Protected, also available as `/api/records/storage-status`)
- `PATCH /api/records/file/:filename` (Protected, body: `password`, `title` and/or `description`)
- `DELETE /api/records/file/:filename` (Protected, body: `password`)
- `GET /api/records/:patientId` (Protected)

Files are not publicly served from `/uploads`; use the protected preview/download APIs.
Uploaded files are also stored in MongoDB (`records.fileData`) so preview/download can still work after stateless redeploys.

## Recommended Indexes

Run in Mongo shell for the `medivault` database:

```javascript
db.users.createIndex({ email: 1 }, { unique: true });
db.records.createIndex({ patientId: 1 });
db.records.createIndex({ userId: 1, createdAt: -1 });
```

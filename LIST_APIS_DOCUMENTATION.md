# 📋 List APIs Documentation

This document contains all the simplified list APIs that were created for the frontend team.

## 🔐 Authentication & Authorization

All APIs require:
- **Authentication**: Bearer token in Authorization header
- **Authorization**: SUPER_ADMIN role only
- **Error Response**: `{"message": "Missing or invalid Authorization header"}` for unauthorized requests

## 📝 Usage Example

```bash
# Get authentication token
TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@example.com", "password": "admin123"}' | \
  grep -o '"token":"[^"]*"' | cut -d'"' -f4)

# Use token for API calls
curl -X GET http://localhost:3000/api/v1/doctors/list \
  -H "Authorization: Bearer $TOKEN"
```

---

## 🩺 1. DOCTORS API

**Endpoint:** `GET /api/v1/doctors/list`

**Description:** Returns a list of all doctors with their ID and name.

**Response Format:**
```json
[
  {
    "id": "6a99d5a9-31b8-4d3b-aad9-ade551fd33a4",
    "name": "Dr. Emily Rodriguez"
  },
  {
    "id": "93e8474b-cce1-48e6-a651-d4ccd70752d9",
    "name": "Dr. James Wilson"
  },
  {
    "id": "6895e7b5-72b2-480d-a802-97eae21013b4",
    "name": "Dr. Michael Chen"
  },
  {
    "id": "448809e7-3fe1-463a-8f26-ca421797e22e",
    "name": "Dr. Sarah Johnson"
  }
]
```

**Fields Returned:**
- `id`: Doctor's unique identifier
- `name`: Doctor's full name

**Features:**
- Returns only users with DOCTOR role
- Sorted alphabetically by name
- Fast performance with selective field querying

---

## 👥 2. PATIENTS API

**Endpoint:** `GET /api/v1/patients/list`

**Description:** Returns a list of all patients with their ID, name, age, and gender.

**Response Format:**
```json
[
  {
    "id": "3c176a6b-f796-4e3d-ad29-a4036ea980e4",
    "name": "Alice Johnson",
    "age": 28,
    "gender": "Female"
  },
  {
    "id": "b69ae4c4-dd9c-4016-81d7-aa5a7087573c",
    "name": "Bob Smith",
    "age": 45,
    "gender": "Male"
  },
  {
    "id": "62f080e2-db7d-455b-b671-f302e20210b2",
    "name": "Carol Williams",
    "age": 32,
    "gender": "Female"
  },
  {
    "id": "1343e6c5-7868-4d84-9281-5980450c0254",
    "name": "David Brown",
    "age": 67,
    "gender": "Male"
  },
  {
    "id": "f5845ae0-7532-4e3b-af1b-13a6748e0e17",
    "name": "Emma Davis",
    "age": 24,
    "gender": "Female"
  },
  {
    "id": "e8465841-7253-4ddb-88ce-2151ffec58d1",
    "name": "Frank Miller",
    "age": 55,
    "gender": "Male"
  },
  {
    "id": "081dfdba-275c-47f0-af86-0bb5dc86a640",
    "name": "Grace Wilson",
    "age": 38,
    "gender": "Female"
  },
  {
    "id": "7a242785-db2c-4c73-9e63-e52bf318240b",
    "name": "Henry Moore",
    "age": 42,
    "gender": "Male"
  },
  {
    "id": "e70adda8-001e-4297-b026-55371378d42c",
    "name": "Ivy Taylor",
    "age": 29,
    "gender": "Female"
  },
  {
    "id": "3c47ac59-edbe-40ee-b9b8-2c8e40d9ed1b",
    "name": "Jack Anderson",
    "age": 51,
    "gender": "Male"
  }
]
```

**Fields Returned:**
- `id`: Patient's unique identifier
- `name`: Patient's full name
- `age`: Patient's age
- `gender`: Patient's gender

**Features:**
- Sorted alphabetically by name
- Contains test data with 10 patients
- Fast performance with selective field querying

---

## 🏥 3. CLINICS API

**Endpoint:** `GET /api/v1/clinics/list`

**Description:** Returns a list of all clinics with their ID, name, address, contact number, and organization ID.

**Response Format:**
```json
[
  {
    "id": "2dfa259c-f085-4ed5-baed-7dced4266502",
    "clinicName": "Central Medical Plaza",
    "clientAddress": "654 Maple Drive, Central District, Phoenix, AZ 85001",
    "contactNumber": "+1-555-0205",
    "organizationId": "ORG-002"
  },
  {
    "id": "a471ea83-1f99-4ce8-9c01-72ba20c2aa89",
    "clinicName": "Downtown Medical Center",
    "clientAddress": "123 Main Street, Downtown District, New York, NY 10001",
    "contactNumber": "+1-555-0201",
    "organizationId": "ORG-001"
  },
  {
    "id": "7ac91dda-dd7e-4dd4-b34f-9b7045e2d035",
    "clinicName": "Eastside Healthcare Center",
    "clientAddress": "321 Elm Boulevard, Eastside, Houston, TX 77001",
    "contactNumber": "+1-555-0204",
    "organizationId": "ORG-003"
  },
  {
    "id": "05748492-762d-4d0b-9337-23351c433554",
    "clinicName": "Mountain View Clinic",
    "clientAddress": "258 Hilltop Avenue, Mountain View, San Diego, CA 92101",
    "contactNumber": "+1-555-0208",
    "organizationId": "ORG-003"
  },
  {
    "id": "b886d1af-a97c-401c-b8ba-cc317436a818",
    "clinicName": "North Point Dental Clinic",
    "clientAddress": "789 Pine Street, North Point, Chicago, IL 60601",
    "contactNumber": "+1-555-0203",
    "organizationId": "ORG-001"
  },
  {
    "id": "93e96ebc-18a8-424e-9ded-276e9dcc5a30",
    "clinicName": "Oceanfront Medical Services",
    "clientAddress": "741 Ocean Drive, Oceanfront, San Jose, CA 95101",
    "contactNumber": "+1-555-0210",
    "organizationId": "ORG-004"
  },
  {
    "id": "28667de8-065a-40eb-845d-c2a1ae86a1c6",
    "clinicName": "Parkview Health Center",
    "clientAddress": "369 Park Street, Parkview District, Dallas, TX 75201",
    "contactNumber": "+1-555-0209",
    "organizationId": "ORG-002"
  },
  {
    "id": "15f39a15-17c9-478b-87fc-8c2b34c5abf7",
    "clinicName": "Riverside Specialty Clinic",
    "clientAddress": "987 River Road, Riverside, Philadelphia, PA 19101",
    "contactNumber": "+1-555-0206",
    "organizationId": "ORG-004"
  },
  {
    "id": "aba6a94e-6045-4852-b971-e0d36e98d02b",
    "clinicName": "Sunset Medical Group",
    "clientAddress": "147 Sunset Boulevard, Sunset Hills, San Antonio, TX 78201",
    "contactNumber": "+1-555-0207",
    "organizationId": "ORG-001"
  },
  {
    "id": "8590966a-cd0b-40b3-9402-0535cbec892c",
    "clinicName": "Westside Family Clinic",
    "clientAddress": "456 Oak Avenue, Westside, Los Angeles, CA 90210",
    "contactNumber": "+1-555-0202",
    "organizationId": "ORG-002"
  }
]
```

**Fields Returned:**
- `id`: Clinic's unique identifier
- `clinicName`: Name of the clinic
- `clientAddress`: Full address of the clinic
- `contactNumber`: Clinic's phone number
- `organizationId`: Organization identifier

**Features:**
- Sorted alphabetically by clinic name
- Contains test data with 10 clinics across different organizations
- Fast performance with selective field querying

---

## 🛍️ 4. PRODUCTS API

**Endpoint:** `GET /api/v1/products/list`

**Description:** Returns a list of all products with their ID, name, warranty, price, and discount.

**Response Format:**
```json
[
  {
    "id": "22fe197b-f312-4782-8e90-450c1fe1d0c2",
    "product": "Crown",
    "warranty": "2 years",
    "price": "500",
    "discount": "10.5"
  },
  {
    "id": "a4d17466-0871-4bba-8916-779aacd85b99",
    "product": "Dental Crown",
    "warranty": "2 years",
    "price": "299.99",
    "discount": "10"
  }
]
```

**Fields Returned:**
- `id`: Product's unique identifier
- `product`: Product name
- `warranty`: Warranty period
- `price`: Product price
- `discount`: Discount percentage

**Features:**
- Sorted alphabetically by product name
- Contains current product data
- Fast performance with selective field querying

---

## 🚀 Implementation Details

### Database Schema Changes
- **User Model**: Added `name` field to support doctor names
- **Migration Applied**: `20251015131655_add_name_to_user`

### Service Layer
- **Doctors**: `getDoctorsList()` - Filters users by DOCTOR role, returns id and name
- **Patients**: `getPatientsList()` - Returns id, name, age, gender
- **Clinics**: `getClinicsList()` - Returns id, clinicName, clientAddress, contactNumber, organizationId
- **Products**: `getProductsList()` - Returns id, product, warranty, price, discount

### Controller Layer
- All controllers follow consistent error handling patterns
- Proper authentication and authorization checks
- Clean JSON responses

### Routes
- All routes are protected with `authenticate` and `authorizeRoles('SUPER_ADMIN')` middleware
- Consistent URL patterns: `/api/v1/{entity}/list`

---

## 📊 Summary

| API | Endpoint | Records | Key Fields |
|-----|----------|---------|------------|
| Doctors | `/api/v1/doctors/list` | 4 | id, name |
| Patients | `/api/v1/patients/list` | 10 | id, name, age, gender |
| Clinics | `/api/v1/clinics/list` | 10 | id, clinicName, clientAddress, contactNumber, organizationId |
| Products | `/api/v1/products/list` | 2 | id, product, warranty, price, discount |

All APIs are fully functional, tested, and ready for frontend integration! 🎉


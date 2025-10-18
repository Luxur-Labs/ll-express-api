# 📋 Complete API Documentation for Frontend Team

## 🔐 Authentication
All APIs (except health and login) require:
- **Header**: `Authorization: Bearer <JWT_TOKEN>`
- **Role**: `SUPER_ADMIN` for all endpoints

---

## 🏥 CLINIC APIs

### Create Clinic
```http
POST /api/v1/clinics
Content-Type: application/json
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "clinicName": "Test Clinic",
  "organizationId": "org-123",
  "clientAddress": "123 Test Street, Test City",
  "contactNumber": "+1234567890"
}
```

**Response (201):**
```json
{
  "id": "d3fceac4-172d-458b-b509-59470c318919",
  "clinicName": "Test Clinic",
  "organizationId": "org-123",
  "clientAddress": "123 Test Street, Test City",
  "contactNumber": "+1234567890",
  "createdAt": "2025-10-15T10:30:23.459Z",
  "updatedAt": "2025-10-15T10:30:23.459Z"
}
```

### Get All Clinics
```http
GET /api/v1/clinics
Authorization: Bearer <token>
```

### Get Clinic by ID
```http
GET /api/v1/clinics/{id}
Authorization: Bearer <token>
```

### Update Clinic
```http
PUT /api/v1/clinics/{id}
Content-Type: application/json
Authorization: Bearer <token>
```

### Delete Clinic
```http
DELETE /api/v1/clinics/{id}
Authorization: Bearer <token>
```

### Get Clinics by Organization
```http
GET /api/v1/clinics/organization/{organizationId}
Authorization: Bearer <token>
```

---

## 📦 PRODUCT APIs

### Create Product
```http
POST /api/v1/products
Content-Type: application/json
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "workType": "Dental",
  "product": "Crown",
  "warranty": "2 years",
  "price": 299.99,
  "discount": 10
}
```

**Response (201):**
```json
{
  "id": "product-id",
  "workType": "Dental",
  "product": "Crown",
  "warranty": "2 years",
  "price": 299.99,
  "discount": 10,
  "createdAt": "2025-10-15T10:30:23.459Z",
  "updatedAt": "2025-10-15T10:30:23.459Z"
}
```

### Get All Products
```http
GET /api/v1/products
Authorization: Bearer <token>
```

### Get Product by ID
```http
GET /api/v1/products/{id}
Authorization: Bearer <token>
```

### Update Product
```http
PUT /api/v1/products/{id}
Content-Type: application/json
Authorization: Bearer <token>
```

### Delete Product
```http
DELETE /api/v1/products/{id}
Authorization: Bearer <token>
```

### Get Products by Work Type
```http
GET /api/v1/products/work-type/{workType}
Authorization: Bearer <token>
```

### Get Products by Price Range
```http
GET /api/v1/products/price-range?minPrice=100&maxPrice=1000
Authorization: Bearer <token>
```

---

## 👤 PATIENT APIs

### Create Patient
```http
POST /api/v1/patients
Content-Type: application/json
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "name": "John Doe",
  "age": 35,
  "gender": "Male",
  "contactNumber": "+1234567890"
}
```

**Response (201):**
```json
{
  "id": "f8ff85e6-6167-41e2-9a7a-7c2adda5388e",
  "name": "John Doe",
  "age": 35,
  "gender": "Male",
  "contactNumber": "+1234567890",
  "createdAt": "2025-10-15T10:49:28.616Z",
  "updatedAt": "2025-10-15T10:49:28.616Z"
}
```

### Get All Patients
```http
GET /api/v1/patients
Authorization: Bearer <token>
```

### Get Patient by ID
```http
GET /api/v1/patients/{id}
Authorization: Bearer <token>
```

### Update Patient
```http
PUT /api/v1/patients/{id}
Content-Type: application/json
Authorization: Bearer <token>
```

### Delete Patient
```http
DELETE /api/v1/patients/{id}
Authorization: Bearer <token>
```

### Search Patients by Name
```http
GET /api/v1/patients/search?name=John
Authorization: Bearer <token>
```

### Get Patients by Gender
```http
GET /api/v1/patients/gender/{gender}
Authorization: Bearer <token>
```

### Get Patients by Age Range
```http
GET /api/v1/patients/age-range?minAge=18&maxAge=65
Authorization: Bearer <token>
```

---

## 📋 ORDER APIs

### Create Order
```http
POST /api/v1/orders
Content-Type: application/json
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "invoiceNumber": "INV-2025-002",
  "patientId": "f8ff85e6-6167-41e2-9a7a-7c2adda5388e",
  "doctorId": "448809e7-3fe1-463a-8f26-ca421797e22e",
  "clinicId": "d3fceac4-172d-458b-b509-59470c318919",
  "referredDoctorId": "optional-doctor-id",
  "partner": "Partner XYZ",
  "scanningMode": "MRI Scan",
  "schedule": "2025-10-22T14:00:00Z",
  "enterRemark": "Follow-up examination",
  "estimateDate": "2025-10-28T00:00:00Z",
  "dateOfApproach": "2025-10-15T00:00:00Z",
  "orderProducts": [
    {
      "productId": "product-id-1",
      "workSpecification": "Complete denture fabrication",
      "shadeType": "A3",
      "finishingInstructions": "High gloss finish with smooth edges",
      "componentDetails": "Acrylic base with porcelain teeth",
      "incaseOfAllAbutments": "Standard procedure",
      "occlusalStaining": "Natural color matching",
      "ponticDesign": "Modified ridge lap",
      "repeatCorrections": "None",
      "enterReason": "Patient request for better fit"
    },
    {
      "productId": "product-id-2",
      "workSpecification": "Crown and bridge work",
      "shadeType": "B2",
      "finishingInstructions": "Ceramic glaze finish",
      "componentDetails": "Zirconia framework with ceramic layering",
      "incaseOfAllAbutments": "Custom preparation",
      "occlusalStaining": "Enhanced contrast",
      "ponticDesign": "Sanitary design",
      "repeatCorrections": "Minor adjustments needed",
      "enterReason": "Improve aesthetics and function"
    }
  ]
}
```

**Response (201):**
```json
{
  "id": "18946b84-f0c8-4e3f-90fd-7158e98a42e4",
  "invoiceNumber": "INV-2025-002",
  "patientId": "f8ff85e6-6167-41e2-9a7a-7c2adda5388e",
  "doctorId": "448809e7-3fe1-463a-8f26-ca421797e22e",
  "clinicId": "d3fceac4-172d-458b-b509-59470c318919",
  "referredDoctorId": null,
  "partner": "Partner XYZ",
  "scanningMode": "MRI Scan",
  "schedule": "2025-10-22T14:00:00.000Z",
  "enterRemark": "Follow-up examination",
  "estimateDate": "2025-10-28T00:00:00.000Z",
  "dateOfApproach": "2025-10-15T00:00:00.000Z",
  "patient": {
    "id": "f8ff85e6-6167-41e2-9a7a-7c2adda5388e",
    "name": "John Doe",
    "age": 35,
    "gender": "Male",
    "contactNumber": "+1234567890"
  },
  "doctor": {
    "id": "448809e7-3fe1-463a-8f26-ca421797e22e",
    "email": "doctor1@example.com",
    "role": "DOCTOR"
  },
  "clinic": {
    "id": "d3fceac4-172d-458b-b509-59470c318919",
    "clinicName": "Test Clinic",
    "organizationId": "org-123",
    "clientAddress": "123 Test Street, Test City",
    "contactNumber": "+1234567890"
  },
  "referredDoctor": null,
  "orderProducts": [
    {
      "id": "ac57c100-b21b-4052-b0ab-42881b905d29",
      "orderId": "18946b84-f0c8-4e3f-90fd-7158e98a42e4",
      "productId": "product-id-1",
      "workSpecification": "Complete denture fabrication",
      "shadeType": "A3",
      "finishingInstructions": "High gloss finish with smooth edges",
      "componentDetails": "Acrylic base with porcelain teeth",
      "incaseOfAllAbutments": "Standard procedure",
      "occlusalStaining": "Natural color matching",
      "ponticDesign": "Modified ridge lap",
      "repeatCorrections": "None",
      "enterReason": "Patient request for better fit",
      "product": {
        "id": "product-id-1",
        "workType": "Dental",
        "product": "Crown",
        "warranty": "2 years",
        "price": 299.99,
        "discount": 10
      }
    }
  ]
}
```

### Get All Orders
```http
GET /api/v1/orders
Authorization: Bearer <token>
```

### Get Order by ID
```http
GET /api/v1/orders/{id}
Authorization: Bearer <token>
```

### Get Order by Invoice Number
```http
GET /api/v1/orders/invoice/{invoiceNumber}
Authorization: Bearer <token>
```

### Update Order
```http
PUT /api/v1/orders/{id}
Content-Type: application/json
Authorization: Bearer <token>
```

### Delete Order
```http
DELETE /api/v1/orders/{id}
Authorization: Bearer <token>
```

### Get Orders by Patient
```http
GET /api/v1/orders/patient/{patientId}
Authorization: Bearer <token>
```

### Get Orders by Doctor
```http
GET /api/v1/orders/doctor/{doctorId}
Authorization: Bearer <token>
```

### Get Orders by Clinic
```http
GET /api/v1/orders/clinic/{clinicId}
Authorization: Bearer <token>
```

### Get Orders by Partner
```http
GET /api/v1/orders/partner/{partner}
Authorization: Bearer <token>
```

### Get Orders by Scanning Mode
```http
GET /api/v1/orders/scanning-mode/{scanningMode}
Authorization: Bearer <token>
```

### Get Orders by Date Range
```http
GET /api/v1/orders/date-range?startDate=2025-10-01T00:00:00Z&endDate=2025-10-31T23:59:59Z
Authorization: Bearer <token>
```

---

## 🔐 AUTH APIs

### Login
```http
POST /api/v1/auth/login
Content-Type: application/json
```

**Request Body:**
```json
{
  "email": "admin@example.com",
  "password": "admin123"
}
```

**Response (200):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "user-id",
    "email": "admin@example.com",
    "role": "SUPER_ADMIN"
  }
}
```

### Forgot Password
```http
POST /api/v1/auth/forgot-password
Content-Type: application/json
```

---

## 🏥 HEALTH API

### Health Check
```http
GET /api/v1/health
```

**Response (200):**
```json
{
  "status": "ok",
  "timestamp": "2025-10-15T11:27:06.762Z"
}
```

---

## 📊 Common Response Formats

### Success Responses
- **200 OK**: GET requests
- **201 Created**: POST requests
- **204 No Content**: DELETE requests

### Error Responses
- **400 Bad Request**: Validation errors
- **401 Unauthorized**: Missing/invalid token
- **403 Forbidden**: Insufficient permissions
- **404 Not Found**: Resource not found
- **500 Internal Server Error**: Server errors

### Validation Error Format
```json
{
  "message": "validation_error",
  "errors": {
    "fieldName": ["Error message 1", "Error message 2"]
  }
}
```

### Generic Error Format
```json
{
  "message": "Error description"
}
```

---

## 🔗 Base URL
```
http://localhost:3000/api/v1
```

## 📝 Field Validation Rules

### Clinic Fields
- `clinicName`: Required, max 255 characters
- `organizationId`: Required
- `clientAddress`: Required
- `contactNumber`: Required, max 20 characters

### Product Fields
- `workType`: Required, max 255 characters
- `product`: Required, max 255 characters
- `warranty`: Required, max 255 characters
- `price`: Required, positive number, max 999999.99
- `discount`: Optional, 0-100, default 0

### Patient Fields
- `name`: Required, max 255 characters
- `age`: Required, integer, 0-150
- `gender`: Required, max 50 characters
- `contactNumber`: Required, max 20 characters

### Order Fields
- `invoiceNumber`: Required, unique, max 255 characters
- `patientId`: Required, must exist
- `doctorId`: Required, must exist
- `clinicId`: Required, must exist
- `referredDoctorId`: Optional, must exist if provided
- `partner`: Required, max 255 characters
- `scanningMode`: Required, max 255 characters
- `schedule`: Required, valid datetime
- `enterRemark`: Required
- `estimateDate`: Required, valid datetime
- `dateOfApproach`: Required, valid datetime

### Order Product Fields (All Required)
- `productId`: Required, must exist
- `workSpecification`: Required, max 500 characters
- `shadeType`: Required, max 100 characters
- `finishingInstructions`: Required, max 500 characters
- `componentDetails`: Required, max 500 characters
- `incaseOfAllAbutments`: Required, max 500 characters
- `occlusalStaining`: Required, max 100 characters
- `ponticDesign`: Required, max 100 characters
- `repeatCorrections`: Required, max 500 characters
- `enterReason`: Required, max 500 characters

---

This documentation covers all available CRUD operations for Clinics, Products, Patients, and Orders, along with their complete request/response structures that your frontend team can use for integration.

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

// No need to import Role type; use string literal values for seeding

const prisma = new PrismaClient();

async function main() {
  const [qc, cadTechnician] = await Promise.all([
    prisma.employeeType.upsert({ where: { name: 'QC' }, update: {}, create: { name: 'QC' } }),
    prisma.technicianGroup.upsert({ where: { name: 'CAD_TECHNICIAN' }, update: {}, create: { name: 'CAD_TECHNICIAN' } }),
  ]);

  await Promise.all([
    prisma.employeeType.upsert({ where: { name: 'TECHNICIAN' }, update: {}, create: { name: 'TECHNICIAN' } }),
    prisma.employeeType.upsert({ where: { name: 'DISPATCHER' }, update: {}, create: { name: 'DISPATCHER' } }),
    prisma.technicianGroup.upsert({ where: { name: 'CAM_TECHNICIAN' }, update: {}, create: { name: 'CAM_TECHNICIAN' } }),
  ]);

  const adminEmail = 'admin@example.com';
  const passwordHash = await bcrypt.hash('admin123', 10);

  const superAdminUser = {
    passwordHash,
    role: 'SUPER_ADMIN' as const,
    employeeTypeId: qc.id,
    technicianGroupId: cadTechnician.id,
  };

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      ...superAdminUser,
    },
  });

  // Alias used by Angular fake-backend docs / local dev curl
  await prisma.user.upsert({
    where: { email: 'admin@luxur.com' },
    update: { passwordHash: superAdminUser.passwordHash },
    create: {
      email: 'admin@luxur.com',
      ...superAdminUser,
    },
  });

  // Delete all existing products
  const deletedCount = await prisma.product.deleteMany({});
  console.log(`🗑️  Deleted ${deletedCount.count} existing products`);

  // Product data with code, name, warranty, and price
  const products: Array<{ code: string; name: string; warranty: string | null; price: number }> = [
    // ZIRCONIA CROWN & BRIDGE (LD 1-8)
    { code: 'LD 1', name: 'SAGEMAX MONOLITHIC', warranty: '5 Years', price: 1199 },
    { code: 'LD 2', name: 'SAGEMAX MONOLITHIC', warranty: '10 Years', price: 1399 },
    { code: 'LD 3', name: 'PREMIUM MULTILAYERED', warranty: '10 Years', price: 1999 },
    { code: 'LD 4', name: 'PREMIUM MULTILAYERED', warranty: '15 Years', price: 2499 },
    { code: 'LD 5', name: 'LUXUR MULTILAYERED', warranty: '20 Years', price: 3999 },
    { code: 'LD 6', name: 'LUXUR MULTILAYERED - PRIME', warranty: 'Life time', price: 11999 },
    { code: 'LD 7', name: 'PREMIUM MULTILAYERED FULL ARCH ZIRCONIA', warranty: null, price: 29999 },
    { code: 'LD 8', name: 'LUXUR MULTILAYERED FULL ARCH ZIRCONIA', warranty: null, price: 56999 },
    
    // DMLS CROWN & BRIDGE (LD 9-15)
    { code: 'LD 9', name: 'DMLS CROWN AND BRIDGE', warranty: '5 Years', price: 899 },
    { code: 'LD 10', name: 'DMLS CROWN AND BRIDGE', warranty: '10 Years', price: 1199 },
    { code: 'LD 11', name: 'DMLS FULL METAL CROWN', warranty: null, price: 499 },
    { code: 'LD 13', name: 'MARYLAND BRIDGE', warranty: null, price: 1199 },
    { code: 'LD 14', name: 'CAD-CAM MILLED/PRINTED', warranty: null, price: 299 },
    { code: 'LD 15', name: 'PUTTY INDEX FOR TEMPORISATION', warranty: null, price: 699 },
    
    // GLASS CERAMIC (LD 16-18)
    { code: 'LD 16', name: 'E-MAX CAD (CROWN/ONLAY/INLAY) (SINGLE UNIT)', warranty: null, price: 4999 },
    { code: 'LD 17', name: 'IPS EMPRESS CAD-CAM VENEERS', warranty: null, price: 3999 },
    { code: 'LD 18', name: 'PRESS VENEERS (BRIDGE UPTO 3 UNITS)', warranty: null, price: 2999 },
    
    // PRECISION ATTACHMENT (LD 19-26)
    { code: 'LD 19', name: 'OT- UNILATERAL ATTACHMENT', warranty: null, price: 6999 },
    { code: 'LD 20', name: 'KEY-KEYWAY PROSTHESIS', warranty: null, price: 2499 },
    { code: 'LD 21', name: 'EQUATOR WITH OT CAP', warranty: null, price: 4999 },
    { code: 'LD 22', name: 'LOCATOR WITH OT CAP', warranty: '5 Years', price: 6999 },
    { code: 'LD 23', name: 'HAGERS ATTACHMENTS', warranty: null, price: 1499 },
    { code: 'LD 24', name: 'ZIRCONIA', warranty: null, price: 2999 },
    { code: 'LD 25', name: 'DMLS CO-CR', warranty: null, price: 1499 },
    { code: 'LD 26', name: 'TITANIUM DMLS', warranty: null, price: 1999 },
    
    // IMPLANT PROSTHETICS (LD 27-31)
    { code: 'LD 27', name: 'DMLS METAL CERAMIC SCREW-RETAINED CROWN WITH CUSTOM-ABUTMENT', warranty: '5 Years', price: 1999 },
    { code: 'LD 28', name: 'DMLS METAL CERAMIC SCREW-RETAINED CROWN WITH CUSTOM-ABUTMENT', warranty: '10 Years', price: 2499 },
    { code: 'LD 29', name: 'ZIRCONIA CROWN WITH DMLS CO-CR SCREW-RETAINED CUSTOM ABUTMENT', warranty: '15 Years', price: 3299 },
    { code: 'LD 30', name: 'IPS eMAX ZirCAD PRIME ZIRCONIA CROWN WITH DMLS CO-CR SCREW-RETAINED CUSTOM ABUTMENT', warranty: '15 Years', price: 4999 },
    { code: 'LD 31', name: 'IPS eMAX ZirCAD PRIME ZIRCONIA CROWN WITH MILLED ZIRCONIA SCREW-RETAINED ABUTMENT', warranty: null, price: 6999 },
    
    // FULL-ARCH IMPLANT PROSTHETICS (LD 32-34)
    { code: 'LD 32', name: 'LUXUR FULL ARCH ZIRCONIA ELITE', warranty: null, price: 74999 },
    { code: 'LD 33', name: 'LUXUR PFM FULL ARCH PRO', warranty: null, price: 29999 },
    { code: 'LD 34', name: 'LUXUR PREMIUM FULL ARCH', warranty: null, price: 19999 },
    
    // FULL-ARCH IMPLANT PROSTHETICS MALO FRAMEWORKS (LD 35-38)
    { code: 'LD 35', name: 'CO-CR FRAMEWORK TO RECEIVE CROWN AND BRIDGE', warranty: null, price: 24999 },
    { code: 'LD 36', name: 'DMLS TITANIUM FRAMEWORK TO RECEIVE CROWN AND BRIDGE', warranty: null, price: 29999 },
    { code: 'LD 37', name: 'LUXUR BIO-HPP PEEK', warranty: null, price: 34999 },
    { code: 'LD 38', name: 'MILLED TITANIUM FRAMEWORK TO RECEIVE CROWN AND BRIDGE/COMPOSITE LAYERING', warranty: null, price: 49999 },
    
    // HYBRID DENTURE & CAST PARTIAL DENTURE (LD 39-43)
    { code: 'LD 39', name: 'HYBRID DENTURE', warranty: null, price: 19999 },
    { code: 'LD 40', name: 'CAST PARTIAL DENTURE UPTO 3 TEETH', warranty: null, price: 6999 },
    { code: 'LD 41', name: 'CAST PARTIAL DENTURE UPTO 6 TEETH', warranty: null, price: 9999 },
    { code: 'LD 42', name: 'CAST PARTIAL DENTURE UPTO 12 TEETH', warranty: null, price: 12999 },
    { code: 'LD 43', name: 'ADDITIONAL CHARGES FOR IVOBASE AND IVOCLAR TEETH SET', warranty: null, price: 4999 },
    
    // PREMIUM COMPLETE DENTURES (LD 44-47)
    { code: 'LD 44', name: 'CLASSIC HEAT CURE DENTURE', warranty: null, price: 3999 },
    { code: 'LD 45', name: 'LUXUR HIGH IMPACT BPS DENTURE', warranty: null, price: 7999 },
    { code: 'LD 46', name: 'LUXUR HIGH IMPACT 3D PRINTED DIGITAL BPS DENTURE', warranty: null, price: 11999 },
    { code: 'LD 47', name: 'LUXUR HIGH IMPACT CAD-CAM MILLED DIGITAL BPS DENTURE', warranty: null, price: 19999 },
    
    // SPLINTS & RETAINERS (LD 48-50)
    { code: 'LD 48', name: 'ESSEX RETAINER/SOFT SPLINT', warranty: null, price: 699 },
    { code: 'LD 49', name: 'SELF-CURE CLEAR ACRYLIC HARD SPLINT', warranty: null, price: 499 },
    { code: 'LD 50', name: 'LUXUR TMD SPLINT/HYBRID SPLINT', warranty: null, price: 1499 },
  ];

  // Seed products
  let createdProducts = 0;

  for (const productData of products) {
    await prisma.product.create({
      data: {
        code: productData.code,
        name: productData.name,
        // Prisma type expects a string; fallback to empty string if null/undefined
        warranty: productData.warranty ?? '',
        price: productData.price,
        discount: 0,
      },
    });
    createdProducts++;
  }

  console.log(`✅ Seeded ${createdProducts} products successfully`);

  // Clinic data - filter out records with missing data or doctorName = "0"
  const clinicDataRaw = [
    { clinicName: "Aga Khan Health Center", doctorName: "Dr. Anam", organizationId: "ORG-001", clientAddress: "Address: Chirag Ali Lane, Abids, Hyderabad, Telangana 500001", contactNumber: "" },
    { clinicName: "AK Dental Clinic", doctorName: "Dr. Sudhakar", organizationId: "ORG-002", clientAddress: "Lanco Hills Rd, above Landmark Gift Gallery, Shivapuri Colony, Shirdi Sai Nagar, Manikonda, Hyderabad, Telangana 500089, India", contactNumber: "9494504444" },
    { clinicName: "Amrutha Dental Clinic", doctorName: "Dr. Amithab", organizationId: "ORG-003", clientAddress: "Ground floor, Tesla, Ashirwad complex, opp: Viveka statue, Main Rd, Raghavendra Colony, Medchal, Hyderabad, Secunderabad, Telangana 501401, India", contactNumber: "9848009842" },
    { clinicName: "Apollo Dental Gowlidoddi", doctorName: "Dr. Gopinath", organizationId: "ORG-004", clientAddress: "Address: 3-15, Wipro Circle Rd, opp. Jayabheri the Nirvana, beside Karachi Bekary, Gowlidoddy, Gopanapally, Hyderabad, Telangana 500032", contactNumber: "6302392546" },
    { clinicName: "Apollo dental kokapet", doctorName: "Dr. Sahit", organizationId: "ORG-005", clientAddress: "Address: Shop No. 204, 2nd Floor, One Building, Gandipet Main Rd, above Cream Stone, Kokapet, Hyderabad, Telangana 500075", contactNumber: "7093745887" },
    { clinicName: "Arjun Multispeciality Dental Clinic", doctorName: "Dr. Naveen", organizationId: "ORG-006", clientAddress: "Address: 110/p, 1st Floor,, Pipe Line Road, opp. Konark Hospital And Sherwood School, Hyderabad, Telangana 500055", contactNumber: "9640435358" },
    { clinicName: "Aryas Dental", doctorName: "Dr. Devnit", organizationId: "ORG-007", clientAddress: "5th Floor, R HUB, Plot 525 & 526, 100 Feet Rd, near YSR Statue, SBH Officers Colony, Mega Hills, Madhapur, Hyderabad, Telangana 500081, India", contactNumber: "8019471360" },
    { clinicName: "Ayigiri Family  Dental Clinic", doctorName: "Dr. Ramakrishna", organizationId: "ORG-008", clientAddress: "Address: Yellareddy colony, bommalagudi, Hayathnagar_Khalsa, Hyderabad, Telangana 501505", contactNumber: "759430045" },
    { clinicName: "Chirunavvu Dental Care | Best Dental Clinic in Nagole", doctorName: "Dr. Sai Krishna", organizationId: "ORG-009", clientAddress: "3rd floor, Plot No. 84, Rd Number 7, Mamatha Nagar Colony, Nagole, Hyderabad, Telangana 500068, India", contactNumber: "8885730405" },
    { clinicName: "Clove Dental Clinic - Srinagar Colony, Hyderabad", doctorName: "Dr. Goutham", organizationId: "ORG-010", clientAddress: "Address: Srinagar Colony Main Road, Yella reddy Guda, opposite Srinagar colony, park, Hyderabad, Telangana 500073", contactNumber: "8466061455" },
    { clinicName: "Clove Dental Clinic - Top Dentist in Botanical Gardens for RCT, Aligners, Braces, Implants, & More", doctorName: "Dr Gangadhar", organizationId: "ORG-011", clientAddress: "D. No. 1-57/181-B, Kranti Complex,Sri Ram Nagar Colony Masidbanda Road, Botanical Gardens, Kondapur, Telangana 500084, India", contactNumber: "9491376761" },
    { clinicName: "Clove Dental Clinic - Top Dentist in Chintal for RCT, Aligners, Braces, Implants, & More", doctorName: "Dr. Vijay", organizationId: "ORG-012", clientAddress: "A-1, 1st Floor, Prabhav Arcade, opp. Asian Sha Shensha Theaters, Chinthal, Hyderabad, Telangana 500055, India", contactNumber: "9440249960" },
    { clinicName: "Clove Dental Clinic - Top Dentist in Jubilee Hills - Road No 1 for RCT, Aligners, Braces, Implants, & More", doctorName: "Dr. Umair", organizationId: "ORG-013", clientAddress: "No.573H&I, 2nd Floor, Above Bentley showroom Parkview complex, Road No. 1, Jubilee Hills, Hyderabad, Telangana 500033, India", contactNumber: "1223456789" },
    { clinicName: "Clove Dental Clinic - Top Dentist in Kukatpally for RCT, Aligners, Braces, Implants, & More", doctorName: "Dr. Liza", organizationId: "ORG-014", clientAddress: "Ganesh Plaza, Hitech City Main Rd, opp. MIG Bus Stop, JNTU, K P H B Phase 6, Kukatpally, Hyderabad, Telangana 500072, India", contactNumber: "7829302055" },
    { clinicName: "Clove Dental Clinic - Top Dentist in Miyapur - Bollaram Road for RCT, Aligners, Braces, Implants, & More", doctorName: "Dr. Gangadhar", organizationId: "ORG-015", clientAddress: "First Floor, Sriven Grand Mall, Bollaram Road, Miyapur, beside Green Trend, above Axis Bank, CG Employees Colony, Mayuri Nagar, Hyderabad, Telangana 500049, India", contactNumber: "8882208844" },
    { clinicName: "Clove Dental Clinic - Top Dentist in Miyapur for RCT, Aligners, Braces, Implants, & More", doctorName: "Dr. Gangadhar", organizationId: "ORG-016", clientAddress: "1st floor, NUK Amrutha Estates, Miyapur, Telangana 500049, India", contactNumber: "6303775466" },
    { clinicName: "Clove Dental Clinic - Top Dentist in Nallagandla for RCT, Aligners, Braces, Implants, & More", doctorName: "Dr. Gangadhar", organizationId: "ORG-017", clientAddress: "369, First Floor, Above ICICI Bank, Kanchi Gachibowli Rd, beside Pranaam Wellness Center, Nallagandla, Telangana 500019, India", contactNumber: "9315902730" },
    { clinicName: "Clove Dental Clinic - Top Dentist in Old Bowenpally for RCT, Aligners, Braces, Implants, & More", doctorName: "Dr. Liza Rahman", organizationId: "ORG-018", clientAddress: "No.1-10-316, Sy.No.130, Bapuji Nagar, X Road, B Thokatta Village, Ganesh Nagar Colony, Bowenpally, Secunderabad, Telangana 500011, India", contactNumber: "7829302055" },
    { clinicName: "Clove Dental Clinic - Top Dentist in Padmarao Nagar for RCT, Aligners, Braces, Implants, & More", doctorName: "Dr. Basith", organizationId: "ORG-019", clientAddress: "No. 50, First Floor, Skanda Complex Street No. 13, opp. Nilgiri Supermarket, Skandagiri, Padmarao Nagar, Secunderabad, Telangana 500061, India", contactNumber: "9315902728" },
    { clinicName: "Clove Dental Clinic - Top Dentist in Paradise for RCT, Aligners, Braces, Implants, & More", doctorName: "Dr. Liza Rahman", organizationId: "ORG-020", clientAddress: "Shop No.3, 1st Floor, Legend Crystal, Mandalay Lane Prendarghast Road, Paradise, Hyderabad, Telangana 500003, India", contactNumber: "7829302055" },
    { clinicName: "Clove Dental Clinic - Top Dentist in Shaikpet for RCT, Aligners, Braces, Implants, & More", doctorName: "Dr. Bilquis", organizationId: "ORG-021", clientAddress: "West World Commercial Complex Plot No: 8-1-302&303, 2nd Floor,, Above Karachi Bakery, Opp: International School Old Mumbai Highway Shaikpet, Hyderabad, Telangana 500008, India", contactNumber: "9666274888" },
    { clinicName: "Clove Dental Clinic - Top Dentist in Suchitra for RCT, Aligners, Braces, Implants, & More", doctorName: "Dr. Bharat", organizationId: "ORG-022", clientAddress: "1st Floor, 118, Beside Pai Electronics, Muzamil Arcade, Suchitra Rd, Green Park, Jeedimetla, Hyderabad, Telangana 500067, India", contactNumber: "7995854888" },
    { clinicName: "Clove Dental Clinic - Top Dentist in Vanasthalipuram for RCT, Aligners, Braces, Implants, & More", doctorName: "Dr. DurgaBhavani", organizationId: "ORG-023", clientAddress: "No. 21, 22, First Floor, Main Road, above ICICI Bank, AK Residency, Vanasthalipuram, Hyderabad, Telangana 500070, India", contactNumber: "9618482896" },
    { clinicName: "Clove Dental Clinic - Top Dentist in Vikrampuri for RCT, Aligners, Braces, Implants, & More", doctorName: "Dr. Liza Rahman", organizationId: "ORG-024", clientAddress: "Ist Floor, Plot No. 8, Wellington Rd, opp. Pullareddy Sweets, Janakapuri, Vikrampuri Colony, Karkhana, Secunderabad, Telangana 500026, India", contactNumber: "7829302055" },
    { clinicName: "Denta Care", doctorName: "Dr. Ramana Reddy", organizationId: "ORG-025", clientAddress: "Address: Lower Ground floor, Inwinex Tower, Road No. 2, opposite Tenet diagnostics, Venkat Nagar, Banjara Hills, Hyderabad, Telangana 500034", contactNumber: "7702962222" },
    { clinicName: "DentaCare Dental Hospital, Implant & Research Institute", doctorName: "Dr. Ramana Reddy", organizationId: "ORG-026", clientAddress: "Address: Lower Ground floor, Inwinex Tower, Road No. 2, opposite Tenet diagnostics, Venkat Nagar, Banjara Hills, Hyderabad, Telangana 500034", contactNumber: "9704566586" },
    { clinicName: "Dental Dontics", doctorName: "Dr. Ashank", organizationId: "ORG-027", clientAddress: "Address: Kalpavruksha Estates, 3-6-475/3/1/2 ground floor, beside HDFC bank, Himayatnagar, Hyderabad, Telangana 500029", contactNumber: "6304064098" },
    { clinicName: "Dental House", doctorName: "Dr. Hari", organizationId: "ORG-028", clientAddress: "Address: Dr, Anna Dorai Chowdary St, Swathi Avenue, Ameerpet, Hyderabad, Telangana 500016", contactNumber: "9440376777" },
    { clinicName: "Dental Magic", doctorName: "Dr. Trupti", organizationId: "ORG-029", clientAddress: "plot no 9, Mani Nagar, My Home Vihanga Rd, near Wipro Circle Road, behind Q City, TNGO's Colony Phase 2, Financial District, Gachibowli, Hyderabad, Telangana 500035, India", contactNumber: "9014270649" },
    { clinicName: "Devi Dental Nagole", doctorName: "Dr. Ravindra babu", organizationId: "ORG-030", clientAddress: "Address: Plot No 29,2_1_14, Rd Number 1B, Mamatha Nagar Colony, Nagole, Hyderabad, Telangana 500068", contactNumber: "9959086650" },
    { clinicName: "Dfine Dental Hospital", doctorName: "Dr. Srinivas", organizationId: "ORG-031", clientAddress: "Sy No 29, Sri Shailajapushpa Chambers, 13-4-27/D,1st floor, Above Pai International Electronics Ltd, 1 Part 77/1, Vikas Nagar, Dilsukhnagar, Hyderabad, Telangana 500060, India", contactNumber: "9193945678" },
    { clinicName: "Dr Godvines clinique", doctorName: "Dr. Godvines", organizationId: "ORG-032", clientAddress: "3-34, Hanumasai Nagar, Vijayapuri Colony, Uppal, Hyderabad, Telangana 500039, India", contactNumber: "9533720547" },
    { clinicName: "Dr. Praveen's Specialty Dental Hospital", doctorName: "Dr. Praveen", organizationId: "ORG-033", clientAddress: "SMR Heights, 15-24-165, Rd Number 1, opp. Holistic Hospital, beside State Bank of India, NRI Branch, Kukatpally Housing Board Colony, Kukatpally, Hyderabad, Telangana 500072, India", contactNumber: "9441555666" },
    { clinicName: "Dr. White dental Care (Madinagudu)", doctorName: "Dr. Sri Lakshmi", organizationId: "ORG-034", clientAddress: "Address: 2nd Floor, 1-58/7A, NH 65, Ramakrishna Nagar, Serilingampalle, Hyderabad, Telangana 500050", contactNumber: "9966001417" },
    { clinicName: "Dr. White dental Care (Nizampet Branch)", doctorName: "Dr. Sri Lakshmi", organizationId: "ORG-035", clientAddress: "Address: 1st Floor, House No. 3, 10/2/A, Main Road, opposite Balaji Park Town, Nizampet, Hyderabad, Telangana 500090", contactNumber: "9966001417" },
    { clinicName: "Duchenne smiles dental", doctorName: "Dr. Pavan", organizationId: "ORG-036", clientAddress: "Address: Plot no 3, Old Airport Rd, Phase 2, Sancharapuri Colony, New Bowenpally, Bowenpally, Secunderabad, Hyderabad, Telangana 500011", contactNumber: "9666655450" },
    { clinicName: "Ekadanta Dental Care - Root Canal Specialists in kondapur", doctorName: "Dr. Swetha", organizationId: "ORG-037", clientAddress: "Address: 1st Floor, H.No-1-57, Plot No-A18, Kondapur, Sri Ram Nagar, Hyderabad, Telangana 500084", contactNumber: "7013826492" },
    { clinicName: "Ekadenta Dental  Madinaguda", doctorName: "Dr. Swetha", organizationId: "ORG-038", clientAddress: "Address: plot no 168 & 182, h.no 4-168 & 182, HIG phase 2 Manjeera Pipeline Rd Madinaguda, Telangana 500050, Hyderabad, Telangana 500049", contactNumber: "7013826492" },
    { clinicName: "Ekdant Wellbeing Dental & Medical Care, Best Dentist in Narsingi, Hyderabad", doctorName: "Dr. Bharati", organizationId: "ORG-039", clientAddress: "Address: Shop no.4A, Ground floor, RR Tropicana, Caterpillar Rd, Narsingi, Hyderabad, Telangana 500089", contactNumber: "9667539640" },
    { clinicName: "Elite Dental care Bowenpally", doctorName: "Dr. Ali", organizationId: "ORG-040", clientAddress: "Address: Plot no 3, Old Airport Rd, Phase 2, Sancharapuri Colony, New Bowenpally, Bowenpally, Secunderabad, Hyderabad, Telangana 500011", contactNumber: "9980907622" },
    { clinicName: "Elite Dental care Champapet", doctorName: "Dr. Ali", organizationId: "ORG-041", clientAddress: "Address: 9-6-60, Hyderabad - Nagarjuna Sagar Rd, Central Excise Colony, New Santoshnagar, Santosh Nagar, Champapet, Hyderabad, Telangana 500059", contactNumber: "9980907622" },
    { clinicName: "Galaxy Dental Care Kondapur", doctorName: "Dr. Sudhakar", organizationId: "ORG-042", clientAddress: "Address: Kondapur, Serilingampally Mandal, Plot no #154, Gachibowli - Miyapur Rd, opposite Harsha Toyota, Kondapur, Hyderabad, Telangana 500084", contactNumber: "8686676781" },
    { clinicName: "Gracious Dental Care", doctorName: "Dr. Ibad Ur Rahman", organizationId: "ORG-043", clientAddress: "Address: H. NO 12, 2-718/2/d, Nanal Nagar, Mehdipatnam, Hyderabad, Telangana 500006", contactNumber: "9989232356" },
    { clinicName: "Guru dental", doctorName: "Dr. Ruchi", organizationId: "ORG-044", clientAddress: "Address: Rd Number 10C, Gayatri Hills, Jubilee Hills, Hyderabad, Telangana 500033", contactNumber: "1223456789" },
    { clinicName: "GVK Dental Centre", doctorName: "Dr. GVK Prasad", organizationId: "ORG-045", clientAddress: "Address: 1st Floor, Captain Veera Raja Reddy Marg, above IDEA showroom, JSN Colony, Vasant Vihar, Habsiguda, Hyderabad, Telangana 500007", contactNumber: "9885099951" },
    { clinicName: "Happy Smiles Dental Care Implant & Maxillofacial Centre", doctorName: "Dr. Swarnalatha", organizationId: "ORG-046", clientAddress: "Address: H.No, S L Square Building, ARUNDATHI, 3-5-886/1-4, Old MLA Quarters Rd, near Kia car showroom, Himayatnagar, Hyderabad, Telangana 500029", contactNumber: "7013457002" },
    { clinicName: "Hare  Krishna  Dental clinic", doctorName: "Dr. Hari Prasad", organizationId: "ORG-047", clientAddress: "Address: 45-169/1, beside balaji gaj kirana store, Srinivas Nagar, Jagathgiri Gutta, Hyderabad, Telangana 500037", contactNumber: "9849818581" },
    { clinicName: "Harsha Super Speciality Dental Hospital", doctorName: "Dr. Harsha Vardan", organizationId: "ORG-048", clientAddress: "Address: 1st Floor, Nirmala Kubera Heights, Beside Spark Hospital, Peerzadiguda, Uppal, Hyderabad, Telangana 500092", contactNumber: "8297724667" },
    { clinicName: "Harshitha Dental", doctorName: "Dr. Harshitha", organizationId: "ORG-049", clientAddress: "Address: 9GCF+W7V, Shalivahana Nagar, Shalivahana Nagar Colony, Dilsukhnagar, Hyderabad, Telangana 500036", contactNumber: "7093030248" },
    { clinicName: "Healthy Smile Dental Care", doctorName: "Dr. Shyam", organizationId: "ORG-050", clientAddress: "Address: G-3 SURAJ MANSION , wellness hospital beside lane ,, Beside mourya tiffin centre opp : Divya Shakti maingate, Shyam karan Road , Ameerpet, Landmark: Divya Shakti apartments, Hyderabad, Telangana 500016", contactNumber: "9704111660" },
    { clinicName: "J Smiles Dental", doctorName: "Dr. Jahanavi", organizationId: "ORG-051", clientAddress: "Address: Capital Pk Rd, Cyber Hills Colony, VIP Hills, Silicon Valley, Madhapur, Hyderabad, Telangana 500081", contactNumber: "7036437357" },
    { clinicName: "Kims Dental , Gachibowli", doctorName: "Dr. Sameer Mahendra", organizationId: "ORG-052", clientAddress: "Address: 7-56/19, Survey No. 40 46, Dargah Road LIG Chitrapuri Colony, Prashant Hills, Radhe Nagar, Gachibowli, Rai Durg, Telangana 500032", contactNumber: "9246804364" },
    { clinicName: "MAARK DENTAL SPECIALITIES | Provides Best Dental Treatment in Khajaguda, Gachibowli - Hyderabad", doctorName: "Dr. Rayalu", organizationId: "ORG-053", clientAddress: "Address: 4th Floor, Deva's Manor, 1-61, Khajaguda - Nanakramguda Rd, opposite Ratnadeep Supermarket, Gachibowli, Hyderabad, Telangana 500104", contactNumber: "9849890009" },
    { clinicName: "Mahendra Dental Hospital", doctorName: "Dr. Sameer", organizationId: "ORG-054", clientAddress: "Address: 1st Floor, Topaz Building, Amrutha Hills, Punjagutta Officers Colony, Punjagutta, Hyderabad, Telangana 500082", contactNumber: "9246804365" },
    { clinicName: "MANA DENTIST- Best dentist in Yapral- Best braces specialist", doctorName: "Dr. Sai Kiran", organizationId: "ORG-055", clientAddress: "Address: Bus Stop, 132, Yapral Main Rd, Kindhi Basthi, Bapuji Nagar, Yapral, Secunderabad, Telangana 500087", contactNumber: "8668942833" },
    { clinicName: "Meghana Dental-Khairathabad", doctorName: "Dr.Ramadei", organizationId: "ORG-056", clientAddress: "Address: 6-3-609/9, Anand Nagar Colony Rd, Anand Nagar Colony, Veera Reddy Colony, Khairtabad, Hyderabad, Telangana 500004", contactNumber: "7396227088" },
    { clinicName: "MODERN DENTAL CARE", doctorName: "Dr. Anil", organizationId: "ORG-057", clientAddress: "Address: 213,3rd floor, HIG, Kukatpally, K P H B Phase 1, Kukatpally, &2, Hyderabad, Telangana 500072", contactNumber: "9494163474" },
    { clinicName: "My Tooth Dental Clinic", doctorName: "Dr. Shyam", organizationId: "ORG-058", clientAddress: "Address: LUCID DIAGNOSTICS, 13-1-104/2 Near Motinagar X roads, E Seva Rd, Hyderabad, Telangana", contactNumber: "9704111660" },
    { clinicName: "N squar dental", doctorName: "Dr. Sandeep", organizationId: "ORG-059", clientAddress: "Address: 2-3-17/A, beside Federal Bank, above Ayush Medicals, Hanumasai Nagar, Vijayapuri Colony, Uppal, Hyderabad, Telangana 500039", contactNumber: "9581698986" },
    { clinicName: "Nyra Smiles Advanced Dental Cosmetic Hospital", doctorName: "Dr. Ghazala", organizationId: "ORG-060", clientAddress: "Address: 10-2-11/4, Income Tax Tower Road, AC Guards, Hyderabad, Telangana 500004", contactNumber: "8897747028" },
    { clinicName: "Padmalathas Super speciality hospitals", doctorName: "Dr. Sravan", organizationId: "ORG-061", clientAddress: "Address: plot no32 mamthanagar,opp to bk reddy nagar park, Nagole, Hyderabad, Telangana 500068", contactNumber: "9581367367" },
    { clinicName: "Praveens Dental- Jublee hills", doctorName: "Dr. Pavan", organizationId: "ORG-062", clientAddress: "Address: Pillar no. 1677, Jubilee Towers, 1st floor, Road No. 36, CBI Colony, Jubilee Hills, Hyderabad, Telangana 500033", contactNumber: "9642648476" },
    { clinicName: "Preethi Dental", doctorName: "Dr. Naga Prasad", organizationId: "ORG-063", clientAddress: "Address: Office, 7/C, near Royal Enfield Show Room, opp. RTO Kondapur Road, New Hafeezpet, Gopal Reddy Nagar, Hafeezpet, Hyderabad, Telangana 500084", contactNumber: "7799393919" },
    { clinicName: "Profile Dental Care", doctorName: "Dr. Praveen", organizationId: "ORG-064", clientAddress: "Address: Ground floor, No 105, Khajaguda - Nanakramguda Rd, opposite to ookridge internation school, Chaitanya Enclave, Khajaguda, Hyderabad, Telangana 500104", contactNumber: "1223456789" },
    { clinicName: "Radix Dental", doctorName: "Dr. Mansoor", organizationId: "ORG-065", clientAddress: "Address: Shaikpet Rd, Lakshmi Nagar Colony, Toli Chowki, Hyderabad, Telangana 500104", contactNumber: "8688371075" },
    { clinicName: "Rama Super Speciality Dental Hospital & Implant Centre", doctorName: "Dr. Shashikanth", organizationId: "ORG-066", clientAddress: "Address: Ground Floor, Shop 14, Kamshetty Mall, Vishal Super Market Complex, Opp. T.V. Studio, Bapu Nagar Rd, beside Vishal Mega Mart, Ramanthapur, Hyderabad, Telangana 500013", contactNumber: "9246197955" },
    { clinicName: "Relief Dental clinic", doctorName: "Dr. Satish", organizationId: "ORG-067", clientAddress: "Address: Indira saga city complex, near, Street Number 1, New SBH Colony, RTC Cross Road, Himayatnagar, Hyderabad, Telangana 500020", contactNumber: "9849294567" },
    { clinicName: "Reva dental", doctorName: "Dr. Ragavendra", organizationId: "ORG-068", clientAddress: "Address: 8-1-284/OU/394/1, OU Colony, Shaikpet, Hyderabad, Telangana 500008", contactNumber: "8639744709" },
    { clinicName: "Roy's Dental Clinic", doctorName: "Dr. Rajesh", organizationId: "ORG-069", clientAddress: "Address: Third floor, KINGSTON HEIGHTS, Lane, Road No. 2, beside Birthplace Hospital, Andhra Pradesh Real Estate, Green Valley, Banjara Hills, Hyderabad, Telangana 500034", contactNumber: "7207334559" },
    { clinicName: "Saagar Dental Hospital", doctorName: "Dr. P Swetha", organizationId: "ORG-070", clientAddress: "Address: Municipal Office Rd, opp. Vyjayanthi Cinema, Koundinya Nagar, Veera Reddy Colony, Ram Reddy Colony, Nacharam, Secunderabad, Telangana 500076", contactNumber: "7207307240" },
    { clinicName: "SAROJINI DENTAL HOSPITAL", doctorName: "Dr. Harsha", organizationId: "ORG-071", clientAddress: "Address: 1st Floor, Vansh hights, Plot No.8, Bowenpally Market Yard Rd, adjacent to hanuman temple, opposite to canara bank, Secunderabad, Telangana 500015", contactNumber: "9849101437" },
    { clinicName: "Shiv Dental Sri nagar colony", doctorName: "Dr. Ratanakar", organizationId: "ORG-072", clientAddress: "Address: 8-3-238/1/B, 1552, Srinagar Colony Main Rd, near Metro Pillar No. C, Sri Nagar Colony, Indiranagar Basti, Yousufguda, Hyderabad, Telangana 500033", contactNumber: "7730900465" },
    { clinicName: "Silver line Dental Care", doctorName: "Dr. Sandeep", organizationId: "ORG-073", clientAddress: "Address: 10-01-39, Masablines, Lane, opp. UPHC Hospital, Veer Nagar, Chintal, Hyderabad, Telangana 500004", contactNumber: "9100971416" },
    { clinicName: "Smile 32 Dental Clinic & Implant Centre domalguda", doctorName: "Dr. Praveen", organizationId: "ORG-074", clientAddress: "Address: Flat No-103,1st Floor, Himayath Nagar Liberty Road, Gagan Mahal, Domalguda, Himayatnagar, Hyderabad, Telangana 500029", contactNumber: "9849605777" },
    { clinicName: "Smile Care Dental Specialities- Dr. Syed Asimuddin, MDS", doctorName: "Dr. Syed Asimuddin", organizationId: "ORG-075", clientAddress: "Address: J Hill Vista, 12-2-831, opp. National Hypermart, beside Bliss Hospital, Hill Colony, Viswash Nagar, Mehdipatnam, Hyderabad, Telangana 500006", contactNumber: "9885162003" },
    { clinicName: "Smile Pro Dental Clinic", doctorName: "Dr. Sameera", organizationId: "ORG-076", clientAddress: "Address: Kondapur, Hanuman Nagar, Prashanth Nagar Colony, Hyderabad, Telangana 500084", contactNumber: "9000994535" },
    { clinicName: "SMYLIFE DENTAL CLINIC", doctorName: "Dr. Harish", organizationId: "ORG-077", clientAddress: "Address: The Forum Sujana Mall, HIG 540/8, old, KPHB 6th Phase Rd, beside Medplus and adithya pharmacy, opposite to Nexus mall, Hyderabad, Telangana 500085", contactNumber: "1223456789" },
    { clinicName: "Spark Eye And Dental Care", doctorName: "Dr. Chitra", organizationId: "ORG-078", clientAddress: "Address: First Floor Vijetha Sanjeevani Apartments Opposite Gandhi Hospital , Metro Pillar No 1034, Musheerabad, Secunderabad, Telangana 500025", contactNumber: "9866627727" },
    { clinicName: "Sree Balaji Super Speciality Dental Hospital Mothinagar", doctorName: "Dr. Balaji", organizationId: "ORG-079", clientAddress: "Address: Shambhavi Residency, E Seva Rd, adjacent to vijetha supermarket, Moti Nagar, Erragadda, Hyderabad, Telangana 500114", contactNumber: "7993727023" },
    { clinicName: "Sree Balaji Super Speciality Dental Madhapur", doctorName: "Dr. Balaji", organizationId: "ORG-080", clientAddress: "Address: Bhaskar Empire, 301, opp. to Minerva grand, Whitefields, Madhapur, Telangana 500081", contactNumber: "7799778063" },
    { clinicName: "Sree Balaji Super Speciality Dental Nizampet", doctorName: "Dr. Balaji", organizationId: "ORG-081", clientAddress: "Address: G2 Floor, Annapurna Towers, Venkatraya Nagar, Nizampet, Hyderabad, Telangana 500090", contactNumber: "9052239920" },
    { clinicName: "SURYA DENTAL CARE KPHB", doctorName: "Dr. Shailaja", organizationId: "ORG-082", clientAddress: "Address: Gokul Plots, Surya Dental Care, Shop G3, Lakshmi Sai Homes, Plot 1796, Vasanth Nagar, K P H B Phase 9, Hyderabad, Telangana 500085", contactNumber: "7702009857" },
    { clinicName: "Swarna Dental", doctorName: "Dr. Sai Kumar", organizationId: "ORG-083", clientAddress: "Address: ZPH School Ln, Bjp Office, Shanthi Nagar, Kukatpally, Hyderabad, Telangana 500072", contactNumber: "9052229397" },
    { clinicName: "Tanisi Dental", doctorName: "Dr. Adiseshamma", organizationId: "ORG-084", clientAddress: "Address: H No 42-994, MIG 99, Phase 2, APHB Colony, Moula Ali, Hyderabad, Secunderabad, Telangana 500040", contactNumber: "9908888154" },
    { clinicName: "Team Teeth Dental", doctorName: "Dr. Sravani", organizationId: "ORG-085", clientAddress: "Address: First floor, paramount building, Dharam Karan Rd, above Madhavi children's clinic, Ameerpet, Hyderabad, Telangana 500018", contactNumber: "9618258480" },
    { clinicName: "Thiruvara Dental Clinics", doctorName: "Dr. Uday", organizationId: "ORG-086", clientAddress: "Address: 8-3-952/10/4, Srinagar Colony Main Rd, Pratap Nagar, Nagarjuna Nagar colony, Punjagutta, Hyderabad, Telangana 500082", contactNumber: "8074676534" },
    { clinicName: "Tooth Preservers", doctorName: "Dr. Vinay", organizationId: "ORG-087", clientAddress: "Address: 2nd Floor, 1-13/2, Gachibowli Rd, above ICICI Bank, P Janardhan Reddy Nagar, Gachibowli, Hyderabad, Telangana 500032", contactNumber: "7207271198" },
    { clinicName: "Toothworks Dental Clinic", doctorName: "Dr. Varun Ahuja", organizationId: "ORG-088", clientAddress: "Address: 1st floor, Apurupa BDR, Road Number 10, opp. spicy venue restaurant, Venkatagiri, Jubilee Hills, Hyderabad, Telangana 500033", contactNumber: "9949592526" },
    { clinicName: "Venus Dental Hospital", doctorName: "Dr. Rama Krishna", organizationId: "ORG-089", clientAddress: "Address: Sri Sai Arcade, JNTU Rd, beside Rythubazar Road, above 2nd floor, Kukatpally Housing Board Colony, Kukatpally, Hyderabad, Telangana 500072", contactNumber: "9885385144" },
    { clinicName: "Vijaya Dental Clinic & Implant Centre", doctorName: "Dr. Vijaya", organizationId: "ORG-090", clientAddress: "Address: H No. 1-1-230/20, 1St Floor, Chikkadpally, Main Road, Hyderabad, Telangana 500020", contactNumber: "96540546131" },
    { clinicName: "Vivek Dental", doctorName: "Dr. Vivek", organizationId: "ORG-091", clientAddress: "Address: 1st floor, Vivek Dental, JJ hospital, Road, near JJ hospital, Laxmi Nagar, Kalyan Nagar Phase 1, Hyderabad, Telangana 500038", contactNumber: "9959938374" },
  ];

  // Filter clinics: must have all required fields and doctorName not "0"
  const validClinics = clinicDataRaw.filter(clinic => 
    clinic.clinicName && 
    clinic.clinicName.trim() !== '' &&
    clinic.doctorName && 
    clinic.doctorName.trim() !== '' && 
    clinic.doctorName !== '0' &&
    clinic.clientAddress && 
    clinic.clientAddress.trim() !== '' &&
    clinic.contactNumber !== undefined
  );

  // Normalize clinic data
  const clinics = validClinics.map(clinic => ({
    clinicName: clinic.clinicName.trim(),
    doctorName: clinic.doctorName.trim(),
    organizationId: clinic.organizationId,
    clientAddress: clinic.clientAddress.trim(),
    contactNumber: clinic.contactNumber || '',
  }));

  // Seed clinics
  let createdClinics = 0;
  let updatedClinics = 0;

  for (const clinicData of clinics) {
    const existing = await prisma.clinic.findFirst({
      where: { 
        clinicName: clinicData.clinicName,
        organizationId: clinicData.organizationId,
      },
    });

    if (!existing) {
      await prisma.clinic.create({ data: clinicData });
      createdClinics++;
      console.log(`✅ Created clinic: ${clinicData.clinicName} (${clinicData.doctorName})`);
    } else {
      await prisma.clinic.update({
        where: { id: existing.id },
        data: {
          clinicName: clinicData.clinicName,
          doctorName: clinicData.doctorName,
          clientAddress: clinicData.clientAddress,
          contactNumber: clinicData.contactNumber,
        } as any,
      });
      updatedClinics++;
      console.log(`🔄 Updated clinic: ${clinicData.clinicName} (${clinicData.doctorName})`);
    }
  }

  console.log(`\n✅ Clinic seeding summary: ${createdClinics} created, ${updatedClinics} updated, ${validClinics.length} total`);
}

main().finally(async () => {
  await prisma.$disconnect();
});

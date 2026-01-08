import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

// No need to import Role type; use string literal values for seeding

const prisma = new PrismaClient();

async function main() {
  const [qc, technician, dispatcher, cadTechnician, camTechnician] = await Promise.all([
    prisma.employeeType.upsert({ where: { name: 'QC' }, update: {}, create: { name: 'QC' } }),
    prisma.employeeType.upsert({ where: { name: 'TECHNICIAN' }, update: {}, create: { name: 'TECHNICIAN' } }),
    prisma.employeeType.upsert({ where: { name: 'DISPATCHER' }, update: {}, create: { name: 'DISPATCHER' } }),
    prisma.technicianGroup.upsert({ where: { name: 'CAD_TECHNICIAN' }, update: {}, create: { name: 'CAD_TECHNICIAN' } }),
    prisma.technicianGroup.upsert({ where: { name: 'CAM_TECHNICIAN' }, update: {}, create: { name: 'CAM_TECHNICIAN' } }),
  ]);

  const adminEmail = 'admin@example.com';
  const passwordHash = await bcrypt.hash('admin123', 10);

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      passwordHash,
      role: 'SUPER_ADMIN',
      employeeTypeId: qc.id,
      technicianGroupId: cadTechnician.id,
    }
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
        warranty: productData.warranty ?? undefined,
        price: productData.price,
        discount: 0,
      },
    });
    createdProducts++;
  }

  console.log(`✅ Seeded ${createdProducts} products successfully`);
}

main().finally(async () => {
  await prisma.$disconnect();
});

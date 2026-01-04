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

  // Helper function to parse price string to number
  const parsePrice = (priceStr: string): number => {
    // Remove all non-numeric characters except decimal point and minus sign
    // Handle ranges like "499-1199" by taking the first value
    const cleaned = priceStr.split('-')[0].replace(/[^\d.]/g, '');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  };

  // Product data (filtering out deleted items)
  const products = [
    { productName: "key-keyway prosthesis", warranty: "string", price: "2499" },
    { productName: "equator with ot cap", warranty: "string", price: "4999" },
    { productName: "locator with ot cap (Casted metal coping with ceramic layering)", warranty: "5 Years", price: "6999" },
    { productName: "haggers attachments", warranty: "string", price: "1499" },
    { productName: "zirconia", warranty: "string", price: "2999" },
    { productName: "dmls co-cr", warranty: "string", price: "1499" },
    { productName: "titanium dmls", warranty: "string", price: "1999" },
    { productName: "dmls metal ceramic(screw-retained crown with custom-abutment and screw)", warranty: "5 Years", price: "1999" },
    { productName: "dmls metal ceramic(screw-retained crown with custom-abutment and screw)", warranty: "10Years", price: "2499" },
    { productName: "zirconia crown with dmls co-cr (screw-retained custom-abutment with screw)", warranty: "15 Years", price: "3299" },
    { productName: "IPS eMAX Zir CAD Prime  zirconia crown with dmls co-cr(screw-retained custom-abutment with screw)", warranty: "15 Years", price: "4999" },
    { productName: "IPS eMAX Zir CAD Prime zirconia crown with milled zirconia(screw-retained abutment with screw)", warranty: "15 Years", price: "6999" },
    { productName: "luxur full arch zirconia elite(Highly Transluscent- Full contour monolithic Gradient Zirconia by Ivoclar- eMAX Zircad Prime milled in  Ivoclar's PM7 machine fused to eMAX ceram porcelain layering on the anteriors for All-On-X cases)", warranty: "string", price: "74999" },
    { productName: "luxur PFM full arch pro(Screw-retained Co-Cr (Colado ®) framework milled in Ivoclar's PM7 machine for the ultimate passivity fused to the Best in class Ivoclar's IPS style ® porcelain for the best aesthetics.)", warranty: "string", price: "29999" },
    { productName: "luxur premium full arch(Screw-retained Co-Cr casted metal framework fused to  Procelain (Ivoclar IPS Classic) fro All-on-cases.)", warranty: "string", price: "19999" },
    { productName: "co-cr framework to receive crown and bridge(MILLED IN IVOCLAR'S PM7 MACHINE USING  COLADO Co-Cr blank.)", warranty: "string", price: "24999" },
    { productName: "dmls titanium framework to receive crown and bridge", warranty: "string", price: "29999" },
    { productName: "luxr bio-hpp peek", warranty: "string", price: "34999" },
    { productName: "milled titanium framework(to recieve crown and bridge/COMPOSITE LAYERING)", warranty: "string", price: "49999" },
    { productName: "classic heat cure denture", warranty: "string", price: "4999" },
    { productName: "luxur high impact BPS denture (Ivoclar's Ivobase acrylisation and Ivoclar's Ivostar and Gnthostar acrylic teeth.)", warranty: "string", price: "7999" },
    { productName: "luxur high impact 3D printed digital BPS denture(3D systems denture base resin (Imported from USA) bonded to 3D systems Micro-Fibre Hybrid teeth.UTS CAD and Gnathometer CAD will be provided to trained dentists from the lab side.)", warranty: "string", price: "11999" },
    { productName: "luxur high impact CAd-CAM millied digital BPS denture (3D systems denture base resin (Imported from USA) bonded to 3D systems Micro- Fibre Hybrid teeth. UTS CAD and Gnathometer CAD will be provided to trained dentists from the lab side.)", warranty: "string", price: "24999" },
    { productName: "Essex retainer/Soft splint(1mm/2mm vaccum adapted thermo-plastic flexible retainers)", warranty: "string", price: "699" },
    { productName: "self-cure clear acrylic hard splint(Ivoclar's Ivobase acrylisation and Ivoclar's Ivostar and Gnathostar acrylic teeth)", warranty: "string", price: "499" },
    { productName: "luxur TMD splint/HYBRID SPLINT(Milled clear acrylic hard splint - highly recommended in  TMD cases and Bruxism)", warranty: "string", price: "1499" },
    { productName: "classic monolithic upcera", warranty: "5 Years", price: "1199" },
    { productName: "classic monolithic-upcera", warranty: "10 Years", price: "1399" },
    { productName: "premium multilayered-SAGEMAX NEXXZR T Multi-Made in USA", warranty: "10 Years", price: "1999" },
    { productName: "premium multilayered-SAGEMAX NEXXZR T Multi-Made in USA", warranty: "15 Years", price: "2499" },
    { productName: "luxur multilayered-IPS eMAX ZIRCAD", warranty: "20 Years", price: "3999" },
    { productName: "luxur multilayered-PS eMAX ZIRCAD Prime", warranty: "Life time", price: "11999" },
    { productName: "premium multilayered full arch zirconia", warranty: "(More than 2 continuous posterior pontics or 4 continuous pontics are not recommended in the full arch. Warranty cannot be applied in such cases)", price: "29999" },
    { productName: "classic monolithic upcera", warranty: "(More than 2 continuous posterior pontics or 4 continuous pontics are not recommended in the full arch.Warranty cannot be applied in such cases)", price: "56999" },
    { productName: "dmls crown and bridge(Ceramic layering using Ivoclar IPS Classic porcelain and bonding using Bredent Cerambond)", warranty: "10 Years", price: "1199" },
    { productName: "dmls full metal crown", warranty: "string", price: "499" },
    { productName: "metal ceramic crown(Casted metal coping with ceramic layering)", warranty: "5 Years", price: "599" },
    { productName: "maryland bridge(Pontic Wing)", warranty: "string", price: "499-1199" },
    { productName: "cad-cam milled/printed(3D Systems Micro-Fibre Hybrid resin)", warranty: "string", price: "299" },
    { productName: "putty index for temporisation", warranty: "string", price: "699" },
    { productName: "lithium di-silicate(IPS eMAX CAD)", warranty: "string", price: "4999(single unit)" },
    { productName: "cad-cam veneers (IPS eMAX empress CAD (Feldspathic ceramic))", warranty: "string", price: "2499" },
    { productName: "press veneers(IPS eMAX press(Feldspathic ceramic))", warranty: "string", price: "2499 (bridge upto 3 unit)" },
    { productName: "ot-unilateral attachment(2 Units Heat-cure CPD with OT-Unilateral attachment kit from Rhein-83)", warranty: "string", price: "6999" },
    { productName: "Hybrid Denture (Co-Cr framework with Ivoclar's Ivobase heat cure acrylic and Ivoclar's Ivostar and Gnathostar acrylic teeth)", warranty: "string", price: "19999" },
    { productName: "Co-Cr framework with conventional DPI heat cure acrylisation Upto 3 teeth", warranty: "string", price: "6999" },
    { productName: "Co-Cr framework with conventional DPI heat cure acrylisation Upto 6 teeth", warranty: "Upto 6 months", price: "9999" },
    { productName: "Co-Cr framework with conventional DPI heat cure acrylisation Upto 12 teeth", warranty: "Upto 12 months", price: "12999" },
    { productName: "Additional charges for Ivobase and Ivoclar teeth set", warranty: "String", price: "4999" },
    { productName: "dmls crown and bridge (Ceramic layering using Ivoclar IPS Classic porcelain)", warranty: "5 Years", price: "899" },
  ];

  // Seed products
  let createdProducts = 0;
  let updatedProducts = 0;

  for (const productData of products) {
    const price = parsePrice(productData.price);
    const warranty = productData.warranty === 'string' ? '' : productData.warranty;

    // Check if product already exists by name
    const existing = await prisma.product.findFirst({
      where: { product: productData.productName },
    });

    if (!existing) {
      await prisma.product.create({
        data: {
          product: productData.productName,
          warranty,
          price,
          discount: 0,
        },
      });
      createdProducts++;
    } else {
      await prisma.product.update({
        where: { id: existing.id },
        data: {
          warranty,
          price,
        },
      });
      updatedProducts++;
    }
  }

  console.log(`✅ Seeded products: ${createdProducts} created, ${updatedProducts} updated`);
}

main().finally(async () => {
  await prisma.$disconnect();
});



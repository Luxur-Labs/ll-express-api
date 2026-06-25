-- Insert clinics ORG-0001 .. ORG-0044.
-- Skips when clinicName already exists (case-insensitive).
-- Run preview first in DBeaver, then the INSERT block.
--
--   npx prisma db execute --file scripts/insert-clinics-org-0001-0048.sql --schema prisma/schema.prisma

-- =============================================================================
-- STEP 1: PREVIEW — run this alone to see what WOULD insert vs skip
-- =============================================================================
WITH incoming AS (
  SELECT * FROM (VALUES
    ('ORG-0001', 'Dr. Sudhakar', 'AK Dental Clinic', '9494504444', 'Lanco Hills Rd, above Landmark Gift Gallery, Shivapuri Colony, Shirdi Sai Nagar, Manikonda, Hyderabad, Telangana 500089, India'),
    ('ORG-0002', 'Dr Sai Ram', 'AP Superspeciality Dental Hospital, Banjara Hills', '8897782254', 'Plot No.89, H.No 8, Banjara Hills, Rd No. 2, 76Beside Centre for Sight Eye Hospital, 2-120, 34, Hyderabad, Telangana 500034'),
    ('ORG-0003', 'Dr. Sharma', 'Apollo dental kokapet', '7093745887', 'Shop No. 204, 2nd Floor, One Building, Gandipet Main Rd, above Cream Stone, Kokapet, Hyderabad, Telangana 500075'),
    ('ORG-0004', 'Dr. Devnit Singh', 'Aryas Dental Madhapur', '8019471360', '5th Floor, R HUB, Plot 525 & 526, 100 Feet Rd, near YSR Statue, SBH Officers Colony, Mega Hills, Madhapur, Hyderabad, Telangana 500081, India'),
    ('ORG-0005', 'Dr. Rohit', 'Aura Dental Care', '7799399008', 'Gandhi Nagar Road, near Padmasali Colony, Thallabasti, Bholakpur, Kavadiguda, Hyderabad, Telangana 500080'),
    ('ORG-0006', 'Dr Ramakrishna', 'Ayigiri Family Dental Clinic', '759430045', 'Yellareddy colony, bommalagudi, Hayathnagar_Khalsa, Hyderabad, Telangana 501505'),
    ('ORG-0007', 'Dr Apoorva', 'Cosmo Radiance Skin & Aesthetic Center', '9009279197', '5th floor, RK Plaza, NH-65, Miyapur ''X'' Road, above Nissan Car Showroom, Mathrusree Nagar, Hafeezpet, Miyapur, Hyderabad, Telangana 500049'),
    ('ORG-0008', 'Dr. Saichand', 'CVS Dental Care', '8790737633', 'Lane No.5, Surya Nagar Colony, IPM Blood Bank Colony, Hayathnagar_Khalsa, Hyderabad, Telangana 501505'),
    ('ORG-0009', 'Dr. Bhanu', 'Denta Care', '7702962222', 'Lower Ground floor, Inwinex Tower, Road No. 2, opposite Tenet diagnostics, Venkat Nagar, Banjara Hills, Hyderabad, Telangana 500034'),
    ('ORG-0010', 'Dr. Srinivas', 'Dfine Dental Hospital', '9193945678', 'Sy No 29, Sri Shailajapushpa Chambers, 13-4-27/D,1st floor, Above Pai International Electronics Ltd, 1 Part 77/1, Vikas Nagar, Dilsukhnagar, Hyderabad, Telangana 500060, India'),
    ('ORG-0011', 'Dr. Godvines', 'Dr Godvines clinique', '9533720547', '3-34, Hanumasai Nagar, Vijayapuri Colony, Uppal, Hyderabad, Telangana 500039, India'),
    ('ORG-0012', 'Dr. Obul Reddy', 'Dr Reddis Dental Clinic - Best Dentist in Kondapur, Hyderabad', '9440415506', 'A, First Floor, 2-41/14, X'' Road, opp. RATNADEEP SUPER MARKET, Hanuman Nagar, Prashanth Nagar Colony, Kondapur, Hyderabad, Telangana 500084'),
    ('ORG-0013', 'Dr. Lahari', 'Dr.Lahari''s Dental Clinic', '7075513505', 'Svr Homes, 51,Street No.1, Lalamma Gardens, pappalguda, Manikonda, Hyderabad, Telangana 500089'),
    ('ORG-0014', 'Dr. Shalini', 'Dr.Teeth Care Dental', '9959461250', '1-1-172/2, Mohan Nagar, Nagol, beside vishal mega mart, Kothapet, Hyderabad, Telangana 500035'),
    ('ORG-0015', 'Dr.Swetha', 'Ekadanta Dental Care - Root Canal Specialists in kondapur', '7013826492', '1st Floor, H.No-1-57, Plot No-A18, Kondapur, Sri Ram Nagar, Hyderabad, Telangana 500084'),
    ('ORG-0016', 'Dr. Swetha', 'Ekadenta Dental Madinaguda', '7013826492', 'plot no 168 & 182, h.no 4-168 & 182, HIG phase 2 Manjeera Pipeline Rd Madinaguda, Telangana 500050, Hyderabad, Telangana 500049'),
    ('ORG-0017', 'Dr. John', 'Grace Dental Clinic', '7330895838', 'Street Number 7, Balram Nagar, Safilguda, Secunderabad, Telangana 500047'),
    ('ORG-0018', 'Dr. Harshavardhan', 'Harsha Super Speciality Dental Hospital', '8297724667', '1st Floor, Nirmala Kubera Heights, Beside Spark Hospital, Peerzadiguda, Uppal, Hyderabad, Telangana 500092'),
    ('ORG-0019', 'Dr. Harshitha', 'Harshitha Dental', '7093030248', '9GCF+W7V, Shalivahana Nagar, Shalivahana Nagar Colony, Dilsukhnagar, Hyderabad, Telangana 500036'),
    ('ORG-0020', 'Dr. Ramakanth Reddy', 'Marvel Dental Care and Implant centre', '8919587192', 'Bus stop, Plot no 955, above Balaji Mithai Bhandar, Nandi Hills, Hyderabad, Telangana 500097'),
    ('ORG-0021', 'Dr. Niranjan', 'Niranjan''s Dental Himayatnagar', '9490077798', 'Rukkus Yellu Arcade, opp. HP petrol pump, Chitrapuri Colony, Barkatpura, Narayanguda, Hyderabad, Telangana 500027'),
    ('ORG-0022', 'Dr. Harsha', 'PEARLS 32 DENTAL CLINIC', '9848389869', '8-3-971/ 201 Katuri Nivas, Srinagar Colony Main Rd, opp. Andhra Bank & Hdfc Banks, Hyderabad, Telangana 500073'),
    ('ORG-0023', 'Dr. Chandramohan', 'Prime Dental Saroornagar', '9866281018', 'H no.11_7_105,plotno c-46, Hyderabad, Telangana 500035'),
    ('ORG-0024', 'Dr Shrushti', 'R Dental', '9912399112', 'near Government Fever Hospital, New Nallakunta, Hyderabad, Telangana 500044'),
    ('ORG-0025', 'Dr. Raghavendra', 'Reva dental', '8639744709', '8-1-284/OU/394/1, OU Colony, Shaikpet, Hyderabad, Telangana 500008'),
    ('ORG-0026', 'Dr. Rajesh', 'Roy''s Dental Clinic', '7207334559', 'Third floor, KINGSTON HEIGHTS, Lane, Road No. 2, beside Birthplace Hospital, Andhra Pradesh Real Estate, Green Valley, Banjara Hills, Hyderabad, Telangana 500034'),
    ('ORG-0027', 'Dr. Manav', 'SM Dental', '9950542333', '8-3-231, A1/16, Lakshmi Narsimha Nagar Rd, Sri Krishna Nagar, Yousufguda, Hyderabad, Telangana 500045'),
    ('ORG-0028', 'Dr. Vinay', 'Smile care and Implant Centre (Odeon enclave)', '7386914166', 'Odeon Enclave, Odeon Enclave Sai Vihar, Advocates Colony, Himayatnagar DHOMALGUDA, Street No. 6, Sai Vihar, Advocates Colony, Himayatnagar, Hyderabad, Telangana 50002'),
    ('ORG-0029', 'Dr. Syed Assimuddin', 'Smile Care Dental Specialities- Dr. Syed Asimuddin, MDS', '9885162003', 'J Hill Vista, 12-2-831, opp. National Hypermart, beside Bliss Hospital, Hill Colony, Viswash Nagar, Mehdipatnam, Hyderabad, Telangana 500006'),
    ('ORG-0030', 'Dr. Anand', 'Smileton Dental- Old Bowenpally | Dental Implants | Aligners | Smile Makeover | Teeth whitening', '8897633966', 'ShopG1, KSR Classic, opp. to Landmark Pristine, Kousalya Nagar Colony, Krishnaja Hills, Bachupally, Hyderabad, Telangana 500090'),
    ('ORG-0031', 'Dr.Arjun', 'Sneha Dental Clinic - Kavadiguda', '9963754040', 'H.No: 1-1-652/C, Arundhati Nagar, Gandhi Nagar, Kavadiguda, Hyderabad, Telangana 500080'),
    ('ORG-0032', 'Dr. Prafulla', 'Sri Sai Nirmala Dental Clinic', '9866468678', 'Shop no 1-84/2/B,, Motinagar, beside hanuman temple, BSP Colony, Moti Nagar, Hyderabad, Telangana 500018'),
    ('ORG-0033', 'Dr.Karthik', 'Sri Venkata Sai Dental Secundarabad', '9014477763', '12-10-402/1, Sri Rayapatnam, Indira Nagar, Padmarao Nagar, Secunderabad, Telangana 500061'),
    ('ORG-0034', 'Dr. Adiseshamma', 'Tanisi Dental', '9908888154', 'H No 42-994, MIG 99, Phase 2, APHB Colony, Moula Ali, Hyderabad, Secunderabad, Telangana 500040'),
    ('ORG-0035', 'Dr. Zeeshan', 'Vihaan Dental', '9133639925', 'Avanti Nagar, Basheer Bagh, Hyderabad, Telangana 500029'),
    ('ORG-0036', 'Dr.Vijaya', 'Vijaya Dental Clinic & Implant Centre', '96540546131', 'H No. 1-1-230/20, 1St Floor, Chikkadpally, Main Road, Hyderabad, Telangana 500020'),
    ('ORG-0037', 'Dr. Nageshwar Rao', 'Lalitha Dental SR Nagar', '9848096391', '23/A Ground Floor Sai Sushma Homes, near Abhiruchi Sweets, Sanjeeva Reddy Nagar, Hyderabad, Telangana 500038'),
    ('ORG-0038', 'Dr Anitha krishna', 'Anita Krishna Dental Clinic', '9866530281', 'H.No 1 - 2 - 397 & 398, 1st Floor, opp. Sadhuram Eye Hospital, Gagan Mahal, Himayatnagar, Hyderabad, Telangana 500029'),
    ('ORG-0039', 'Dr. Hemanth', 'Dr.Hemanth''s Dental Implants and Facial Plastic Surgery', '9966094521', 'C-108, Phase I, Vanasthalipuram, Hyderabad, Telangana 500070'),
    ('ORG-0040', 'Dr. Ashiq', 'Lakhani Dental Care A Multispeciality Dental Clinic', '9981517998', '8-369/1/C, H.No. 5, Fateh Sultan Ln, near Global Medical Hall, Abids, Hyderabad, Telangana 500001'),
    ('ORG-0041', 'Dr Sameera', 'Smile Pro Dental Clinic', '9000994535', 'Kondapur, Hanuman Nagar, Prashanth Nagar Colony, Hyderabad, Telangana 500084'),
    ('ORG-0042', 'Dr. B Swapna', 'Madhav''s Dental Care', '7893794067', 'KVR Hospital, near 16 Shutters Road, Attapur, Krishna Nagar, Rajendranagar mandal, Hyderabad, Upperpally, Telangana 500048'),
    ('ORG-0043', 'Dr Haranadh', 'Adithri Dental Dilsukhnagar', '9912777222', 'Ground floor ,Badam complex, Next to Khazana Jewellers, Opposite: Pushpa, Gardens,, Chaithanyapuri ; Dilshuknager, Hyderabad, Telangana 500060'),
    ('ORG-0044', 'Dr.Sirisha', 'SriSIRA DENTAL CARE', '7396257808', 'GLOBAL INDIAN INTERNATIONAL SCHOOL, ROAD NO:3;SAI RAM NAGAR COLONY;PEERZADIGUDA, lane, opp. :, Medipally, Dist:Medchal, Malkajgiri, Hyderabad, Telangana 500098')
  ) AS t(organization_id, doctor_name, clinic_name, contact_number, client_address)
)
SELECT
  i.organization_id,
  i.clinic_name,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM "Clinic" c
      WHERE LOWER(TRIM(c."clinicName")) = LOWER(TRIM(i.clinic_name))
    ) THEN 'SKIP (name exists)'
    ELSE 'WILL INSERT'
  END AS action
FROM incoming i
ORDER BY i.organization_id;

-- =============================================================================
-- STEP 2: INSERT — only new clinic names; shows each row inserted
-- =============================================================================
INSERT INTO "Clinic" (
  id, "clinicName", "organizationId", "clientAddress", "contactNumber",
  "doctorName", "isActive", "pendingBalance", "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid(),
  v.clinic_name,
  v.organization_id,
  v.client_address,
  v.contact_number,
  v.doctor_name,
  true,
  0,
  NOW(),
  NOW()
FROM (VALUES
  ('ORG-0001', 'Dr. Sudhakar', 'AK Dental Clinic', '9494504444', 'Lanco Hills Rd, above Landmark Gift Gallery, Shivapuri Colony, Shirdi Sai Nagar, Manikonda, Hyderabad, Telangana 500089, India'),
  ('ORG-0002', 'Dr Sai Ram', 'AP Superspeciality Dental Hospital, Banjara Hills', '8897782254', 'Plot No.89, H.No 8, Banjara Hills, Rd No. 2, 76Beside Centre for Sight Eye Hospital, 2-120, 34, Hyderabad, Telangana 500034'),
  ('ORG-0003', 'Dr. Sharma', 'Apollo dental kokapet', '7093745887', 'Shop No. 204, 2nd Floor, One Building, Gandipet Main Rd, above Cream Stone, Kokapet, Hyderabad, Telangana 500075'),
  ('ORG-0004', 'Dr. Devnit Singh', 'Aryas Dental Madhapur', '8019471360', '5th Floor, R HUB, Plot 525 & 526, 100 Feet Rd, near YSR Statue, SBH Officers Colony, Mega Hills, Madhapur, Hyderabad, Telangana 500081, India'),
  ('ORG-0005', 'Dr. Rohit', 'Aura Dental Care', '7799399008', 'Gandhi Nagar Road, near Padmasali Colony, Thallabasti, Bholakpur, Kavadiguda, Hyderabad, Telangana 500080'),
  ('ORG-0006', 'Dr Ramakrishna', 'Ayigiri Family Dental Clinic', '759430045', 'Yellareddy colony, bommalagudi, Hayathnagar_Khalsa, Hyderabad, Telangana 501505'),
  ('ORG-0007', 'Dr Apoorva', 'Cosmo Radiance Skin & Aesthetic Center', '9009279197', '5th floor, RK Plaza, NH-65, Miyapur ''X'' Road, above Nissan Car Showroom, Mathrusree Nagar, Hafeezpet, Miyapur, Hyderabad, Telangana 500049'),
  ('ORG-0008', 'Dr. Saichand', 'CVS Dental Care', '8790737633', 'Lane No.5, Surya Nagar Colony, IPM Blood Bank Colony, Hayathnagar_Khalsa, Hyderabad, Telangana 501505'),
  ('ORG-0009', 'Dr. Bhanu', 'Denta Care', '7702962222', 'Lower Ground floor, Inwinex Tower, Road No. 2, opposite Tenet diagnostics, Venkat Nagar, Banjara Hills, Hyderabad, Telangana 500034'),
  ('ORG-0010', 'Dr. Srinivas', 'Dfine Dental Hospital', '9193945678', 'Sy No 29, Sri Shailajapushpa Chambers, 13-4-27/D,1st floor, Above Pai International Electronics Ltd, 1 Part 77/1, Vikas Nagar, Dilsukhnagar, Hyderabad, Telangana 500060, India'),
  ('ORG-0011', 'Dr. Godvines', 'Dr Godvines clinique', '9533720547', '3-34, Hanumasai Nagar, Vijayapuri Colony, Uppal, Hyderabad, Telangana 500039, India'),
  ('ORG-0012', 'Dr. Obul Reddy', 'Dr Reddis Dental Clinic - Best Dentist in Kondapur, Hyderabad', '9440415506', 'A, First Floor, 2-41/14, X'' Road, opp. RATNADEEP SUPER MARKET, Hanuman Nagar, Prashanth Nagar Colony, Kondapur, Hyderabad, Telangana 500084'),
  ('ORG-0013', 'Dr. Lahari', 'Dr.Lahari''s Dental Clinic', '7075513505', 'Svr Homes, 51,Street No.1, Lalamma Gardens, pappalguda, Manikonda, Hyderabad, Telangana 500089'),
  ('ORG-0014', 'Dr. Shalini', 'Dr.Teeth Care Dental', '9959461250', '1-1-172/2, Mohan Nagar, Nagol, beside vishal mega mart, Kothapet, Hyderabad, Telangana 500035'),
  ('ORG-0015', 'Dr.Swetha', 'Ekadanta Dental Care - Root Canal Specialists in kondapur', '7013826492', '1st Floor, H.No-1-57, Plot No-A18, Kondapur, Sri Ram Nagar, Hyderabad, Telangana 500084'),
  ('ORG-0016', 'Dr. Swetha', 'Ekadenta Dental Madinaguda', '7013826492', 'plot no 168 & 182, h.no 4-168 & 182, HIG phase 2 Manjeera Pipeline Rd Madinaguda, Telangana 500050, Hyderabad, Telangana 500049'),
  ('ORG-0017', 'Dr. John', 'Grace Dental Clinic', '7330895838', 'Street Number 7, Balram Nagar, Safilguda, Secunderabad, Telangana 500047'),
  ('ORG-0018', 'Dr. Harshavardhan', 'Harsha Super Speciality Dental Hospital', '8297724667', '1st Floor, Nirmala Kubera Heights, Beside Spark Hospital, Peerzadiguda, Uppal, Hyderabad, Telangana 500092'),
  ('ORG-0019', 'Dr. Harshitha', 'Harshitha Dental', '7093030248', '9GCF+W7V, Shalivahana Nagar, Shalivahana Nagar Colony, Dilsukhnagar, Hyderabad, Telangana 500036'),
  ('ORG-0020', 'Dr. Ramakanth Reddy', 'Marvel Dental Care and Implant centre', '8919587192', 'Bus stop, Plot no 955, above Balaji Mithai Bhandar, Nandi Hills, Hyderabad, Telangana 500097'),
  ('ORG-0021', 'Dr. Niranjan', 'Niranjan''s Dental Himayatnagar', '9490077798', 'Rukkus Yellu Arcade, opp. HP petrol pump, Chitrapuri Colony, Barkatpura, Narayanguda, Hyderabad, Telangana 500027'),
  ('ORG-0022', 'Dr. Harsha', 'PEARLS 32 DENTAL CLINIC', '9848389869', '8-3-971/ 201 Katuri Nivas, Srinagar Colony Main Rd, opp. Andhra Bank & Hdfc Banks, Hyderabad, Telangana 500073'),
  ('ORG-0023', 'Dr. Chandramohan', 'Prime Dental Saroornagar', '9866281018', 'H no.11_7_105,plotno c-46, Hyderabad, Telangana 500035'),
  ('ORG-0024', 'Dr Shrushti', 'R Dental', '9912399112', 'near Government Fever Hospital, New Nallakunta, Hyderabad, Telangana 500044'),
  ('ORG-0025', 'Dr. Raghavendra', 'Reva dental', '8639744709', '8-1-284/OU/394/1, OU Colony, Shaikpet, Hyderabad, Telangana 500008'),
  ('ORG-0026', 'Dr. Rajesh', 'Roy''s Dental Clinic', '7207334559', 'Third floor, KINGSTON HEIGHTS, Lane, Road No. 2, beside Birthplace Hospital, Andhra Pradesh Real Estate, Green Valley, Banjara Hills, Hyderabad, Telangana 500034'),
  ('ORG-0027', 'Dr. Manav', 'SM Dental', '9950542333', '8-3-231, A1/16, Lakshmi Narsimha Nagar Rd, Sri Krishna Nagar, Yousufguda, Hyderabad, Telangana 500045'),
  ('ORG-0028', 'Dr. Vinay', 'Smile care and Implant Centre (Odeon enclave)', '7386914166', 'Odeon Enclave, Odeon Enclave Sai Vihar, Advocates Colony, Himayatnagar DHOMALGUDA, Street No. 6, Sai Vihar, Advocates Colony, Himayatnagar, Hyderabad, Telangana 50002'),
  ('ORG-0029', 'Dr. Syed Assimuddin', 'Smile Care Dental Specialities- Dr. Syed Asimuddin, MDS', '9885162003', 'J Hill Vista, 12-2-831, opp. National Hypermart, beside Bliss Hospital, Hill Colony, Viswash Nagar, Mehdipatnam, Hyderabad, Telangana 500006'),
  ('ORG-0030', 'Dr. Anand', 'Smileton Dental- Old Bowenpally | Dental Implants | Aligners | Smile Makeover | Teeth whitening', '8897633966', 'ShopG1, KSR Classic, opp. to Landmark Pristine, Kousalya Nagar Colony, Krishnaja Hills, Bachupally, Hyderabad, Telangana 500090'),
  ('ORG-0031', 'Dr.Arjun', 'Sneha Dental Clinic - Kavadiguda', '9963754040', 'H.No: 1-1-652/C, Arundhati Nagar, Gandhi Nagar, Kavadiguda, Hyderabad, Telangana 500080'),
  ('ORG-0032', 'Dr. Prafulla', 'Sri Sai Nirmala Dental Clinic', '9866468678', 'Shop no 1-84/2/B,, Motinagar, beside hanuman temple, BSP Colony, Moti Nagar, Hyderabad, Telangana 500018'),
  ('ORG-0033', 'Dr.Karthik', 'Sri Venkata Sai Dental Secundarabad', '9014477763', '12-10-402/1, Sri Rayapatnam, Indira Nagar, Padmarao Nagar, Secunderabad, Telangana 500061'),
  ('ORG-0034', 'Dr. Adiseshamma', 'Tanisi Dental', '9908888154', 'H No 42-994, MIG 99, Phase 2, APHB Colony, Moula Ali, Hyderabad, Secunderabad, Telangana 500040'),
  ('ORG-0035', 'Dr. Zeeshan', 'Vihaan Dental', '9133639925', 'Avanti Nagar, Basheer Bagh, Hyderabad, Telangana 500029'),
  ('ORG-0036', 'Dr.Vijaya', 'Vijaya Dental Clinic & Implant Centre', '96540546131', 'H No. 1-1-230/20, 1St Floor, Chikkadpally, Main Road, Hyderabad, Telangana 500020'),
  ('ORG-0037', 'Dr. Nageshwar Rao', 'Lalitha Dental SR Nagar', '9848096391', '23/A Ground Floor Sai Sushma Homes, near Abhiruchi Sweets, Sanjeeva Reddy Nagar, Hyderabad, Telangana 500038'),
  ('ORG-0038', 'Dr Anitha krishna', 'Anita Krishna Dental Clinic', '9866530281', 'H.No 1 - 2 - 397 & 398, 1st Floor, opp. Sadhuram Eye Hospital, Gagan Mahal, Himayatnagar, Hyderabad, Telangana 500029'),
  ('ORG-0039', 'Dr. Hemanth', 'Dr.Hemanth''s Dental Implants and Facial Plastic Surgery', '9966094521', 'C-108, Phase I, Vanasthalipuram, Hyderabad, Telangana 500070'),
  ('ORG-0040', 'Dr. Ashiq', 'Lakhani Dental Care A Multispeciality Dental Clinic', '9981517998', '8-369/1/C, H.No. 5, Fateh Sultan Ln, near Global Medical Hall, Abids, Hyderabad, Telangana 500001'),
  ('ORG-0041', 'Dr Sameera', 'Smile Pro Dental Clinic', '9000994535', 'Kondapur, Hanuman Nagar, Prashanth Nagar Colony, Hyderabad, Telangana 500084'),
  ('ORG-0042', 'Dr. B Swapna', 'Madhav''s Dental Care', '7893794067', 'KVR Hospital, near 16 Shutters Road, Attapur, Krishna Nagar, Rajendranagar mandal, Hyderabad, Upperpally, Telangana 500048'),
  ('ORG-0043', 'Dr Haranadh', 'Adithri Dental Dilsukhnagar', '9912777222', 'Ground floor ,Badam complex, Next to Khazana Jewellers, Opposite: Pushpa, Gardens,, Chaithanyapuri ; Dilshuknager, Hyderabad, Telangana 500060'),
  ('ORG-0044', 'Dr.Sirisha', 'SriSIRA DENTAL CARE', '7396257808', 'GLOBAL INDIAN INTERNATIONAL SCHOOL, ROAD NO:3;SAI RAM NAGAR COLONY;PEERZADIGUDA, lane, opp. :, Medipally, Dist:Medchal, Malkajgiri, Hyderabad, Telangana 500098')
) AS v(organization_id, doctor_name, clinic_name, contact_number, client_address)
WHERE TRIM(v.contact_number) <> ''
  AND NOT EXISTS (
    SELECT 1
    FROM "Clinic" c
    WHERE LOWER(TRIM(c."clinicName")) = LOWER(TRIM(v.clinic_name))
  )
RETURNING "organizationId", "clinicName", "doctorName";

-- Sample data from app/lib/data.ts. Run after migrations/0001_schema.sql.
-- Generated — re-running fails on duplicate keys; truncate tables first if needed.

insert into vehicles (id, name, tagline, seats, base, per_km, per_min, min_fare, cancel_fee, eta, enabled, ac_option, parcel_max_kg, sort) values
  ('bike', 'Bike', 'Beat the traffic', 1, 20, 6, 1, 30, 15, 2, true, false, 10, 0),
  ('auto', 'Auto', 'No bargaining', 3, 30, 10, 1.5, 45, 20, 4, true, false, 50, 1),
  ('mini', 'Mini', 'Compact hatchbacks', 4, 45, 12, 2, 80, 30, 5, true, true, 100, 2),
  ('sedan', 'Sedan', 'Comfy rides, extra legroom', 4, 60, 15, 2, 110, 40, 6, true, true, 0, 3),
  ('suv', 'XL', 'Extra legroom, 6 seats + luggage', 6, 90, 20, 2.5, 160, 50, 8, true, true, 0, 4);

insert into parcel_weights (id, label, kg, extra, sort) values
  ('w1', 'Up to 1 kg', 1, 0, 0),
  ('w5', '1 – 5 kg', 5, 10, 1),
  ('w10', '5 – 10 kg', 10, 25, 2),
  ('w20', '10 – 20 kg', 20, 45, 3),
  ('w50', '20 – 50 kg', 50, 80, 4);

insert into coupons (code, title, body, off, pct, max, expires, uses, active) values
  ('FIRST50', '50% off your first ride', 'Up to ₹100 off on any vehicle', 50, true, 100, '2026-10-31', 1284, true),
  ('AUTO20', 'Flat ₹20 off on Auto', 'Valid on Auto rides above ₹80', 20, false, null, '2026-10-15', 642, true),
  ('WEEKEND', '15% off weekend rides', 'Sat & Sun · up to ₹75 off', 15, true, 75, '2026-11-30', 311, true),
  ('AIRPORT99', '₹99 off airport drops', 'Sedan & XL to IGI Airport', 99, false, null, '2026-12-31', 87, false);

insert into hotspots (id, area, km, surge, waiting) values
  ('hs1', 'Sector 18 Market, Noida', 1.4, 1.5, 23),
  ('hs2', 'Botanical Garden Metro', 2.1, 1.3, 17),
  ('hs3', 'Great India Place', 2.8, 1.2, 11),
  ('hs4', 'Film City, Sector 16A', 3.5, 1.1, 6);

insert into incentives (id, title, body, target, reward, kind, ends) values
  ('in1', 'Daily Target', 'Complete 5 trips today', 5, 500, 'today', 'Ends 11:59 PM'),
  ('in2', 'Peak Hour Hero', '3 trips between 6 PM – 9 PM', 3, 250, 'peak', 'Today, 6 – 9 PM'),
  ('in3', 'Weekly Streak', 'Complete 60 trips this week', 60, 2000, 'week', 'Ends Sun, 5 Oct');

insert into customers (id, name, phone, email, rating, blocked, complaints, joined) values
  ('CUS2001', 'Amit Sharma', '+91 98765 43210', 'amit.sharma@gmail.com', 4.9, false, 0, '2026-02-02 00:00:00+05:30'),
  ('CUS2002', 'Priya Mehta', '+91 87654 32109', 'priya.m@outlook.com', 4.7, false, 1, '2026-03-19 00:00:00+05:30'),
  ('CUS2003', 'Neha Gupta', '+91 76543 21098', 'neha.gupta@yahoo.in', 4.8, false, 0, '2026-04-07 00:00:00+05:30'),
  ('CUS2004', 'Vikash Singh', '+91 65432 10987', 'vikash.s@gmail.com', 4.1, true, 2, '2026-05-22 00:00:00+05:30'),
  ('CUS2005', 'Kavya Iyer', '+91 99887 76655', 'kavya.iyer@gmail.com', 5, false, 0, '2026-01-11 00:00:00+05:30'),
  ('CUS2006', 'Rahul Verma', '+91 91234 56780', 'rahul.v@gmail.com', 4.5, false, 0, '2026-06-30 00:00:00+05:30');

insert into drivers (id, name, phone, rating, vehicle, model, plate, city, kyc, online, suspended, joined) values
  ('DRV1001', 'Rohit Kumar', '+91 98100 12345', 4.8, 'sedan', 'Maruti Dzire · White', 'UP16 AB 1234', 'Noida', 'Approved', true, false, '2026-01-12 00:00:00+05:30'),
  ('DRV1002', 'Suresh Pal', '+91 98111 45678', 4.6, 'auto', 'Bajaj RE · Green', 'DL 1C 5678', 'Delhi', 'Approved', true, false, '2026-02-03 00:00:00+05:30'),
  ('DRV1003', 'Rakesh Das', '+91 98222 90120', 4.2, 'mini', 'Hyundai i10 · Grey', 'BR01 CD 9012', 'Noida', 'Approved', false, false, '2026-03-20 00:00:00+05:30'),
  ('DRV1004', 'Manoj Tiwari', '+91 98333 34560', 4.9, 'suv', 'Toyota Innova · Silver', 'UP32 EF 3456', 'Lucknow', 'Approved', true, false, '2025-11-08 00:00:00+05:30'),
  ('DRV1005', 'Imran Khan', '+91 98444 11223', 4.7, 'bike', 'Honda Shine · Black', 'DL 3S AB 1122', 'Delhi', 'Approved', true, false, '2026-04-14 00:00:00+05:30'),
  ('DRV1006', 'Vikram Singh', '+91 98555 66778', 0, 'sedan', 'Honda Amaze · Blue', 'HR26 GH 6677', 'Gurugram', 'Pending', false, false, '2026-09-26 00:00:00+05:30'),
  ('DRV1007', 'Arjun Yadav', '+91 98666 22334', 0, 'auto', 'Piaggio Ape · Yellow', 'UP16 JK 2233', 'Noida', 'Pending', false, false, '2026-09-27 00:00:00+05:30'),
  ('DRV1008', 'Deepak Sharma', '+91 98777 88990', 3.9, 'mini', 'Maruti Swift · Red', 'DL 8C LM 8899', 'Delhi', 'Approved', false, true, '2026-06-02 00:00:00+05:30');

insert into places (customer_id, name, address, kind) values
  ('CUS2001', 'Home', 'B-42, Sector 62, Noida', 'home'),
  ('CUS2001', 'Work', 'Tower C, Cyber City, Gurugram', 'work'),
  ('CUS2001', 'DLF Mall of India', 'Sector 18, Noida', 'recent'),
  ('CUS2001', 'IGI Airport T3', 'New Delhi 110037', 'recent'),
  ('CUS2001', 'Connaught Place', 'Rajiv Chowk, New Delhi', null),
  ('CUS2001', 'Botanical Garden Metro', 'Sector 38, Noida', null),
  ('CUS2001', 'Akshardham Temple', 'NH 24, New Delhi', null),
  ('CUS2001', 'Great India Place', 'Sector 38A, Noida', null);

insert into rides (id, service, customer_id, driver_id, vehicle, ac, from_address, to_address, km, min, fare, discount, coupon_code, pay, paid, status, rating, cancel_reason, parcel_type, parcel_weight, parcel_receiver, parcel_receiver_phone, parcel_note, created_at) values
  ('PD1291', 'parcel', 'CUS2006', 'DRV1005', 'bike', null, 'Sector 29, Gurugram', 'Cyber City, Gurugram', 4.8, 15, 62, 0, null, 'UPI', true, 'Started', null, null, 'Documents', 'w1', 'Sneha Verma', '+91 98100 77881', null, '2026-09-28 10:50:00+05:30'),
  ('PD1290', 'parcel', 'CUS2005', 'DRV1002', 'auto', null, 'Sector 18, Noida', 'Okhla, Delhi', 9.4, 29, 196, 0, null, 'Cash', true, 'Completed', 5, null, 'Groceries', 'w20', 'Lata Iyer', '+91 98111 22334', 'Ring the bell twice', '2026-09-28 09:15:00+05:30'),
  ('RD1289', 'ride', 'CUS2001', 'DRV1001', 'sedan', true, 'Sector 12, Noida', 'DLF Mall of India', 4.2, 16, 160, 0, null, 'UPI', true, 'Completed', 5, null, null, null, null, null, null, '2026-09-28 10:38:00+05:30'),
  ('RD1288', 'ride', 'CUS2002', 'DRV1002', 'auto', null, 'Botanical Garden Metro', 'Sector 62, Noida', 6.8, 22, 132, 0, null, 'Cash', false, 'Started', null, null, null, null, null, null, null, '2026-09-28 10:21:00+05:30'),
  ('RD1287', 'ride', 'CUS2003', 'DRV1004', 'suv', true, 'Connaught Place', 'IGI Airport T3', 16.4, 46, 533, 99, 'AIRPORT99', 'Card', true, 'Completed', 4, null, null, null, null, null, null, '2026-09-28 09:52:00+05:30'),
  ('RD1286', 'ride', 'CUS2004', 'DRV1003', 'mini', false, 'Great India Place', 'Akshardham Temple', 9.1, 28, 180, 0, null, 'Cash', false, 'Cancelled', null, 'Driver taking too long', null, null, null, null, null, '2026-09-28 09:40:00+05:30'),
  ('RD1285', 'ride', 'CUS2005', 'DRV1005', 'bike', null, 'Sector 18, Noida', 'Sector 50, Noida', 5.3, 14, 66, 0, null, 'UPI', true, 'Arriving', null, null, null, null, null, null, null, '2026-09-28 10:44:00+05:30'),
  ('RD1284', 'ride', 'CUS2001', 'DRV1002', 'auto', null, 'Yesterday · Noida', 'Okhla, Delhi', 11.2, 34, 240, 20, 'AUTO20', 'Wallet', true, 'Completed', 4, null, null, null, null, null, null, '2026-09-27 20:20:00+05:30'),
  ('RD1283', 'ride', 'CUS2006', 'DRV1001', 'sedan', false, 'Cyber City, Gurugram', 'Sector 29, Gurugram', 5.6, 19, 182, 0, null, 'UPI', true, 'Completed', 5, null, null, null, null, null, null, '2026-09-27 19:05:00+05:30'),
  ('RD1282', 'ride', 'CUS2002', 'DRV1008', 'mini', true, 'Lajpat Nagar', 'Saket', 6.1, 24, 166, 0, null, 'Cash', true, 'Completed', 3, null, null, null, null, null, null, '2026-09-27 17:48:00+05:30'),
  ('RD1281', 'ride', 'CUS2003', 'DRV1005', 'bike', null, 'Sector 62, Noida', 'Sector 15, Noida', 7.2, 18, 81, 0, null, 'UPI', true, 'Completed', 5, null, null, null, null, null, null, '2026-09-26 09:12:00+05:30'),
  ('RD1280', 'ride', 'CUS2005', 'DRV1004', 'suv', true, 'Home', 'Jewar Airport', 38.5, 64, 1020, 75, 'WEEKEND', 'Card', true, 'Completed', 5, null, null, null, null, null, null, '2026-09-26 06:30:00+05:30'),
  ('RD1270', 'ride', 'CUS2001', 'DRV1004', 'suv', true, 'Airport T3', 'Home', 34, 58, 380, 0, null, 'Card', true, 'Completed', 5, null, null, null, null, null, null, '2026-09-18 23:15:00+05:30'),
  ('PD1276', 'parcel', 'CUS2001', 'DRV1005', 'bike', null, 'Home', 'Work', 21, 52, 182, 0, null, 'UPI', true, 'Completed', 5, null, 'Documents', 'w1', 'Ravi (Reception)', '+91 99990 12345', null, '2026-09-22 13:10:00+05:30'),
  ('RD1262', 'ride', 'CUS2001', 'DRV1005', 'bike', null, 'Work', 'Botanical Garden', 6.4, 17, 70, 0, null, 'Cash', true, 'Cancelled', null, 'Changed my plans', null, null, null, null, null, '2026-09-12 18:40:00+05:30');

insert into feedback (driver_id, customer_id, stars, text, created_at) values
  ('DRV1001', 'CUS2001', 5, 'Very polite and drove safely. Car was spotless.', '2026-09-28 00:00:00+05:30'),
  ('DRV1001', 'CUS2006', 5, 'Reached on time, knew a shortcut through traffic.', '2026-09-27 00:00:00+05:30'),
  ('DRV1001', 'CUS2003', 4, 'Good ride, AC could have been cooler.', '2026-09-25 00:00:00+05:30');

insert into transactions (id, kind, who, amount, method, ride_id, created_at) values
  ('TX9012', 'Ride Fare', 'Amit Sharma', 160, 'UPI', 'RD1289', '2026-09-28 10:54:00+05:30'),
  ('TX9011', 'Commission', 'Rohit Kumar', -32, 'UPI', 'RD1289', '2026-09-28 10:54:00+05:30'),
  ('TX9010', 'Ride Fare', 'Neha Gupta', 434, 'Card', 'RD1287', '2026-09-28 10:40:00+05:30'),
  ('TX9009', 'Commission', 'Manoj Tiwari', -87, 'Card', 'RD1287', '2026-09-28 10:40:00+05:30'),
  ('TX9008', 'Driver Payout', 'Suresh Pal', -6420, 'Bank', null, '2026-09-28 09:00:00+05:30'),
  ('TX9007', 'Refund', 'Priya Mehta', -166, 'UPI', 'RD1282', '2026-09-27 19:30:00+05:30'),
  ('TX9006', 'Ride Fare', 'Kavya Iyer', 945, 'Card', 'RD1280', '2026-09-26 07:36:00+05:30'),
  ('TX9005', 'Driver Payout', 'Rohit Kumar', -12840, 'Bank', null, '2026-09-22 09:00:00+05:30');

insert into wallet_txns (id, driver_id, kind, note, amount, created_at) values
  ('WT311', 'DRV1001', 'Trip Earning', 'Ride RD1289 · UPI', 128, '2026-09-28 10:54:00+05:30'),
  ('WT310', 'DRV1001', 'Cash Commission', 'Ride RD1283 · 20% of ₹182', -36, '2026-09-27 19:24:00+05:30'),
  ('WT309', 'DRV1001', 'Incentive', 'Daily Target bonus', 500, '2026-09-27 23:59:00+05:30'),
  ('WT308', 'DRV1001', 'Payout', 'Weekly settlement · HDFC ••4521', -12840, '2026-09-22 09:00:00+05:30');

insert into tickets (id, from_name, role, subject, ride_id, status, created_at) values
  ('TK501', 'Priya Mehta', 'Customer', 'Charged twice for ride RD1282', 'RD1282', 'Open', '2026-09-28 09:10:00+05:30'),
  ('TK500', 'Suresh Pal', 'Driver', 'Payout for 21–27 Sep not received', null, 'In Progress', '2026-09-27 18:44:00+05:30'),
  ('TK499', 'Vikash Singh', 'Customer', 'Driver was rude, cancelled ride', 'RD1286', 'Open', '2026-09-27 15:20:00+05:30'),
  ('TK498', 'Kavya Iyer', 'Customer', 'Left my umbrella in the XL', 'RD1280', 'Resolved', '2026-09-26 10:02:00+05:30');

insert into ticket_notes (ticket_id, body) values
  ('TK500', 'Checked with finance — settlement batch runs Monday.'),
  ('TK498', 'Driver returned the item on 26 Sep.');


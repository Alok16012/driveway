import type { Metadata } from "next";
import { LegalPage } from "../components/LegalPage";

export const metadata: Metadata = { title: "Privacy Policy · DriveWay", description: "What DriveWay collects, why, who it is shared with, and how to delete it." };

export default function Page() {
  return (
    <LegalPage title="Privacy Policy" updated="11 November 2026">
      <p>This policy covers the DriveWay customer app, the DriveWay Partner app (for riders and drivers), the DriveWay Admin app and drivewayride.in (together, &quot;DriveWay&quot;). It explains what we collect, why, who we share it with and how you can delete it.</p>

      <h2>What we collect</h2>
      <ul>
        <li><b>Account:</b> name, mobile number, email address and password (passwords are stored hashed by our authentication provider; we never see them).</li>
        <li><b>Location:</b> customers — the pickup point (GPS position while booking) and drop point; riders — GPS position while online and during a trip, including when the app is in the background during a live trip, so the customer can see the rider coming and the fare can be calculated.</li>
        <li><b>Rider details (riders only):</b> photo, driving licence, vehicle RC, insurance and Aadhaar images for verification (KYC); vehicle model and number; city; UPI ID for payouts.</li>
        <li><b>Trips and payments:</b> pickup and drop, distance, time, fare, payment method, wallet transactions, coupons, ratings and cancellation reasons.</li>
        <li><b>Support:</b> messages you send to our support team.</li>
        <li><b>Device:</b> basic technical data needed to run the app (app version, error information). We do not use advertising IDs and do not show ads.</li>
      </ul>

      <h2>Why we use it</h2>
      <ul>
        <li>To match customers with nearby riders, show the route, live location and arrival time, and complete the trip.</li>
        <li>To calculate fares, process payments, rider earnings, payouts and refunds.</li>
        <li>To verify riders and keep customers and riders safe (OTP at pickup, ratings, SOS, blocking misuse).</li>
        <li>To answer support requests and meet legal, tax and accounting obligations.</li>
      </ul>

      <h2>Who sees it</h2>
      <ul>
        <li><b>During a trip:</b> the customer sees the rider&apos;s name, photo initials, vehicle, number plate, rating, phone number and live location; the rider sees the customer&apos;s name, rating, phone number, pickup and drop.</li>
        <li><b>Service providers</b> who process data for us: Supabase (database, login and file storage), Netlify (website hosting), Ola Maps and OpenStreetMap services (maps, place search, addresses and road distance — they receive map positions, not your name or number).</li>
        <li><b>Authorities,</b> when required by law or to protect someone&apos;s safety.</li>
      </ul>
      <p>We do not sell your personal data and do not share it for advertising.</p>

      <h2>Security and storage</h2>
      <p>Data is sent over encrypted connections (HTTPS) and stored with access controls: customers and riders can only read their own records, and rider documents are in private storage readable only by that rider and DriveWay admins.</p>

      <h2>How long we keep it</h2>
      <p>We keep your account data while your account is open. When you delete your account, your name, phone, email, saved places, rider documents, vehicle details and UPI ID are removed. Trip and payment records are kept without your name, because accounting and tax law require it.</p>

      <h2>Your choices</h2>
      <ul>
        <li>Location: you can turn off location permission at any time in your phone settings; you can then pick a pickup point from the list. Riders need location to go online.</li>
        <li>Edit your name and phone in the app (Account → Edit Profile).</li>
        <li>Delete your account in the app (Account → Delete account) or on <a href="/delete-account">drivewayride.in/delete-account</a>.</li>
      </ul>

      <h2>Children</h2>
      <p>DriveWay is for people aged 18 and over. Riders must hold a valid driving licence.</p>

      <h2>Contact</h2>
      <p>Questions or requests about your data: use Help &amp; Support in the app. We reply within a few working days.</p>

      <h2>Changes</h2>
      <p>If we change this policy we will update the date above, and tell you in the app for important changes.</p>
    </LegalPage>
  );
}

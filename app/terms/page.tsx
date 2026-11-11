import type { Metadata } from "next";
import { LegalPage } from "../components/LegalPage";

export const metadata: Metadata = { title: "Terms of Service · DriveWay", description: "The rules for using DriveWay as a customer or a rider." };

export default function Page() {
  return (
    <LegalPage title="Terms of Service" updated="11 November 2026">
      <p>By creating an account or using DriveWay you agree to these terms. If you don&apos;t agree, please don&apos;t use the service.</p>

      <h2>The service</h2>
      <p>DriveWay is a platform that connects customers who need a ride or a parcel delivery with independent riders and drivers in the cities we serve. Riders are not DriveWay employees.</p>

      <h2>Accounts</h2>
      <ul>
        <li>You must be 18 or older and give correct details. Keep your password private; you are responsible for activity on your account.</li>
        <li>We may block or suspend accounts that break these terms, misuse the service or put others at risk.</li>
      </ul>

      <h2>Customers</h2>
      <ul>
        <li>The fare shown before booking is an estimate based on distance and time; waiting time, add-ons and a booking charge are shown separately. Shared rides are cheaper and may stop for other passengers on the way.</li>
        <li>Share the OTP with your rider only at pickup. A cancellation fee applies if you cancel after the rider is on the way.</li>
        <li>Pay the amount due at the end of the trip by the method you chose.</li>
      </ul>

      <h2>Riders</h2>
      <ul>
        <li>You must hold a valid licence, registration and insurance for your vehicle, pass verification and follow traffic laws.</li>
        <li>DriveWay charges a platform fee per trip from your wallet; your wallet must have enough balance to accept rides. Cash collected from customers is adjusted against your wallet. Payouts go to your UPI ID.</li>
        <li>Referral bonuses and incentives are paid as shown in the app and may be changed or stopped by DriveWay.</li>
      </ul>

      <h2>Safety and conduct</h2>
      <p>No harassment, discrimination, unsafe driving, illegal items or fraud. Use SOS or call 112 in an emergency.</p>

      <h2>Liability</h2>
      <p>DriveWay provides the platform &quot;as is&quot;. To the extent allowed by law, DriveWay is not liable for indirect losses, or for acts of riders or customers. Nothing here limits rights you have under Indian consumer law.</p>

      <h2>Ending your account</h2>
      <p>You can delete your account at any time (see <a href="/delete-account">Delete your account</a>). Sections on payments and liability continue to apply to past trips.</p>

      <h2>Law</h2>
      <p>These terms are governed by the laws of India. Contact us first through Help &amp; Support in the app to resolve any issue.</p>
    </LegalPage>
  );
}

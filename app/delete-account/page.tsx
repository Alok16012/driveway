import type { Metadata } from "next";
import { LegalPage } from "../components/LegalPage";
import { DeleteAccountForm } from "./DeleteAccountForm";

export const metadata: Metadata = { title: "Delete your account · DriveWay", description: "How to delete your DriveWay customer or rider account and what happens to your data." };

export default function Page() {
  return (
    <LegalPage title="Delete your DriveWay account" updated="11 November 2026">
      <p>This works for both the <b>DriveWay</b> customer app and the <b>DriveWay Rider</b> app.</p>
      <h2>In the app</h2>
      <p>Open the app → <b>Account / Profile</b> → <b>Delete account</b> at the bottom → type DELETE → <b>Delete account</b>.</p>
      <h2>On this website</h2>
      <p>Sign in with the email and password you use in the app:</p>
      <DeleteAccountForm />
      <h2>What is deleted</h2>
      <ul>
        <li>Your name, mobile number, email, login and saved places — straight away.</li>
        <li>For riders: KYC documents (photo, licence, RC, insurance, Aadhaar), vehicle details and UPI ID.</li>
        <li>Your support chats.</li>
      </ul>
      <h2>What is kept</h2>
      <ul>
        <li>Trip and payment records, without your name or contact details, because accounting and tax law require it.</li>
      </ul>
      <h2>Before you delete</h2>
      <ul>
        <li>Finish or cancel any ride in progress.</li>
        <li>Riders: withdraw your wallet balance and clear any cash dues first.</li>
      </ul>
      <p>Can&apos;t sign in? Use <b>Forgot password</b> in the app, or message Help &amp; Support in the app and we will delete the account for you.</p>
    </LegalPage>
  );
}

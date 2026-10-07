import Image from "next/image";

/* Delivery partner on a scooter — the picture for parcel bookings (public/vehicles/parcel.webp). */
export default function ParcelArt({ size = 56 }: { size?: number }) {
  const h = Math.round(size * 0.62);
  return <Image src="/vehicles/parcel.webp" alt="" aria-hidden="true" width={size} height={h} style={{ width: size, height: h, objectFit: "contain" }} />;
}

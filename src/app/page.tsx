import Link from "next/link";

export default function Home() {
  return (
    <div className="card">
      <h1>Book your next visit</h1>
      <p className="muted">
        Brightside Salons is a fictional company. This app is an open-source demo of a code review
        and repair, not a real business.
      </p>
      <div className="actions">
        <Link className="button" href="/signup">Create an account</Link>
        <Link className="button" href="/book">Book an appointment</Link>
      </div>
    </div>
  );
}

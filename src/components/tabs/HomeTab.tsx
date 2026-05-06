import { useState } from "react";
import { LOGOS } from "../../constants";

export default function HomeTab() {
  const [logoIdx, setLogoIdx] = useState(0);
  const cycleLogo = () => setLogoIdx((i) => (i + 1) % LOGOS.length);

  return (
    <div className="home">
      <div className="home-card">
        <div className="photo-carousel" onClick={cycleLogo}>
          {LOGOS.map((src, i) => (
            <img key={src} src={src} alt="McRun"
              className={`home-photo${i === logoIdx ? " home-photo--active" : ""}`} />
          ))}
        </div>
        <blockquote className="home-quote">
          <p className="home-quote-text">&ldquo;Pain is inevitable.<br />Suffering is optional.&rdquo;</p>
          <footer className="home-quote-author">&mdash; Haruki Murakami</footer>
        </blockquote>
      </div>
    </div>
  );
}

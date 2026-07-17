"use client";
import { useEffect, useState } from "react";
import { ArrowRight, X } from "lucide-react";

export default function AnimatedSearchBar({
  value,
  onChange,
  words,
  accentColor,
}: {
  value: string;
  onChange: (val: string) => void;
  words: string[];
  accentColor: string;
}) {
  const [displayText, setDisplayText] = useState("");
  const [wordIndex, setWordIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (isFocused || words.length === 0) return;
    const currentWord = words[wordIndex % words.length];

    const timeout = setTimeout(() => {
      if (!isDeleting && charIndex < currentWord.length) {
        setDisplayText(currentWord.substring(0, charIndex + 1));
        setCharIndex(charIndex + 1);
      } else if (isDeleting && charIndex > 0) {
        setDisplayText(currentWord.substring(0, charIndex - 1));
        setCharIndex(charIndex - 1);
      } else if (!isDeleting && charIndex === currentWord.length) {
        setTimeout(() => setIsDeleting(true), 1000);
      } else if (isDeleting && charIndex === 0) {
        setIsDeleting(false);
        setWordIndex((wordIndex + 1) % words.length);
      }
    }, isDeleting ? 60 : 120);

    return () => clearTimeout(timeout);
  }, [charIndex, isDeleting, wordIndex, isFocused, words]);

  function handleBlur() {
    setIsFocused(false);
    if (!value) {
      setCharIndex(0);
      setDisplayText("");
      setIsDeleting(false);
    }
  }

  return (
    <div className="flex items-center justify-center p-4 mt-10">
      <div
        className="flex items-center border-2 rounded-full px-6 py-3 w-full max-w-2xl bg-white shadow-lg hover:shadow-xl transition-shadow"
        style={{ borderColor: accentColor }}
      >
        {!value && (
          <span className="whitespace-nowrap font-medium" style={{ color: accentColor }}>
            Search for&nbsp;
          </span>
        )}

        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={handleBlur}
          placeholder={!isFocused && !value ? displayText : ""}
          className="flex-1 outline-none bg-transparent font-medium"
          style={{ color: accentColor }}
        />

        {value ? (
          <button
            onClick={() => onChange("")}
            className="rounded-full p-2 text-white transition-colors ml-2 flex-shrink-0"
            style={{ background: accentColor }}
            aria-label="Clear search"
          >
            <X size={18} />
          </button>
        ) : (
          <button
            className="rounded-full p-2 text-white transition-colors ml-2 flex-shrink-0"
            style={{ background: accentColor }}
            aria-label="Search"
          >
            <ArrowRight size={18} />
          </button>
        )}
      </div>
    </div>
  );
}

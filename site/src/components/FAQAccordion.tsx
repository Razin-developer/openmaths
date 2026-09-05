"use client";

import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";

export interface FAQItem {
  question: string;
  answer: string;
  category: string;
}

export function FAQAccordion({ items }: { items: FAQItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const categories = Array.from(new Set(items.map((item) => item.category)));
  const baseId = useId();

  return (
    <div className="flex flex-col gap-10">
      {categories.map((category) => (
        <div key={category} className="flex flex-col gap-2">
          <h2 className="mb-2 text-h4 font-semibold">{category}</h2>
          {items
            .map((item, globalIndex) => ({ item, globalIndex }))
            .filter(({ item }) => item.category === category)
            .map(({ item, globalIndex }) => {
              const isOpen = openIndex === globalIndex;
              return (
                <div key={item.question} className="border-b border-border">
                  <button
                    id={`${baseId}-trigger-${globalIndex}`}
                    onClick={() => setOpenIndex(isOpen ? null : globalIndex)}
                    aria-expanded={isOpen}
                    aria-controls={`${baseId}-panel-${globalIndex}`}
                    className="flex w-full items-center justify-between gap-4 py-4 text-left text-body font-medium"
                  >
                    {item.question}
                    <ChevronDown className={`size-4 shrink-0 text-muted-foreground transition-transform duration-base ${isOpen ? "rotate-180" : ""}`} />
                  </button>
                  {isOpen && (
                    <p
                      id={`${baseId}-panel-${globalIndex}`}
                      role="region"
                      aria-labelledby={`${baseId}-trigger-${globalIndex}`}
                      className="pb-4 text-body-sm text-muted-foreground"
                    >
                      {item.answer}
                    </p>
                  )}
                </div>
              );
            })}
        </div>
      ))}
    </div>
  );
}

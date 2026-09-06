import type { Metadata } from "next";
import { Section } from "@/components/Section";
import { ProseArticle } from "@/components/ProseArticle";
import { LegalNotice } from "@/components/LegalNotice";
import Content, { metadata as pageMeta } from "@/content/legal/cookies.mdx";

export const metadata: Metadata = { title: pageMeta.title, alternates: { canonical: "https://openmaths.com/cookies" } };

export default function CookiesPage() {
  return (
    <Section>
      <h1 className="mb-2 text-center text-display-xl font-semibold text-balance">{pageMeta.title}</h1>
      <LegalNotice />
      <ProseArticle>
        <Content />
      </ProseArticle>
    </Section>
  );
}

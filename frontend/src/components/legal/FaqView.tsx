import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LegalPageShell } from './LegalPageShell';
import { Icon } from '../ui/Icon';

interface FaqItem {
  q: string;
  a: string[];
}

interface FaqCategory {
  id: string;
  titleKey: string;
  items: FaqItem[];
}

const CATEGORIES: FaqCategory[] = [
  {
    id: 'faq-quotes',
    titleKey: 'faq.c1t',
    items: [
      { q: 'faq.c1q1', a: ['faq.c1a1p1', 'faq.c1a1p2'] },
      { q: 'faq.c1q2', a: ['faq.c1a2'] },
      { q: 'faq.c1q3', a: ['faq.c1a3'] },
    ],
  },
  {
    id: 'faq-cad',
    titleKey: 'faq.c2t',
    items: [
      { q: 'faq.c2q1', a: ['faq.c2a1'] },
      { q: 'faq.c2q2', a: ['faq.c2a2'] },
    ],
  },
  {
    id: 'faq-mfg',
    titleKey: 'faq.c3t',
    items: [
      { q: 'faq.c3q1', a: ['faq.c3a1'] },
      { q: 'faq.c3q2', a: ['faq.c3a2'] },
    ],
  },
  {
    id: 'faq-pricing',
    titleKey: 'faq.c4t',
    items: [
      { q: 'faq.c4q1', a: ['faq.c4a1'] },
      { q: 'faq.c4q2', a: ['faq.c4a2'] },
    ],
  },
  {
    id: 'faq-payments',
    titleKey: 'faq.c5t',
    items: [{ q: 'faq.c5q1', a: ['faq.c5a1'] }],
  },
  {
    id: 'faq-shipping',
    titleKey: 'faq.c6t',
    items: [
      { q: 'faq.c6q1', a: ['faq.c6a1'] },
      { q: 'faq.c6q2', a: ['faq.c6a2'] },
    ],
  },
  {
    id: 'faq-ip',
    titleKey: 'faq.c7t',
    items: [{ q: 'faq.c7q1', a: ['faq.c7a1'] }],
  },
  {
    id: 'faq-support',
    titleKey: 'faq.c8t',
    items: [{ q: 'faq.c8q1', a: ['faq.c8a1'] }],
  },
];

export const FaqView: React.FC = () => {
  const { t } = useTranslation();
  const [open, setOpen] = useState<string | null>('faq.c1q1');
  return (
    <LegalPageShell
      viewId="view-faq"
      eyebrowKey="faq.eyebrow"
      titleKey="faq.title"
      statementKey="faq.statement"
      toc={CATEGORIES.map((c) => ({ id: c.id, titleKey: c.titleKey }))}
      hideFaqCta
    >
      {CATEGORIES.map((cat) => (
        <section className="legal-section faq-category" id={cat.id} key={cat.id} aria-labelledby={`${cat.id}-title`}>
          <h2 id={`${cat.id}-title`}>{t(cat.titleKey)}</h2>
          <div className="faq-list">
            {cat.items.map((item) => {
              const isOpen = open === item.q;
              return (
                <div className={`faq-item${isOpen ? ' is-open' : ''}`} key={item.q}>
                  <button
                    type="button"
                    className="faq-question"
                    aria-expanded={isOpen}
                    onClick={() => setOpen(isOpen ? null : item.q)}
                  >
                    <span>{t(item.q)}</span>
                    <Icon name="chevronDown" size={18} className={`faq-chevron${isOpen ? ' is-open' : ''}`} />
                  </button>
                  {isOpen ? (
                    <div className="faq-answer">
                      {item.a.map((p) => (
                        <p key={p}>{t(p)}</p>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </LegalPageShell>
  );
};

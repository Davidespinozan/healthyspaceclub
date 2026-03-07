import { useState } from 'react';
import { foodGuideIntro, foodGuideCategories, type FoodCategory, type FoodItem } from '../data/foodGuide';

export default function FoodGuide() {
  const [openCat, setOpenCat] = useState<string | null>(null);
  const [openItem, setOpenItem] = useState<string | null>(null);

  const toggleCat = (id: string) => {
    setOpenCat(prev => prev === id ? null : id);
    setOpenItem(null);
  };
  const toggleItem = (key: string) => setOpenItem(prev => prev === key ? null : key);

  return (
    <div className="fg-wrap">
      {/* Intro */}
      <div className="fg-intro">
        <h3>{foodGuideIntro.title}</h3>
        {foodGuideIntro.paragraphs.map((p, i) => <p key={i}>{p}</p>)}
        <div className="fg-howto">
          <span className="fg-howto-title">¿Cómo usar esta guía?</span>
          <ol>
            {foodGuideIntro.howTo.map((h, i) => <li key={i}>{h}</li>)}
          </ol>
        </div>
      </div>

      {/* Categories */}
      <div className="fg-categories">
        {foodGuideCategories.map(cat => (
          <CategoryCard
            key={cat.id}
            cat={cat}
            isOpen={openCat === cat.id}
            onToggle={() => toggleCat(cat.id)}
            openItem={openItem}
            onToggleItem={toggleItem}
          />
        ))}
      </div>
    </div>
  );
}

function CategoryCard({ cat, isOpen, onToggle, openItem, onToggleItem }: {
  cat: FoodCategory; isOpen: boolean; onToggle: () => void;
  openItem: string | null; onToggleItem: (k: string) => void;
}) {
  return (
    <div className={`fg-cat${isOpen ? ' open' : ''}`}>
      <button className="fg-cat-header" onClick={onToggle}>
        <span className="fg-cat-icon">{cat.icon}</span>
        <span className="fg-cat-title">{cat.title}</span>
        <span className="fg-cat-count">{cat.items.length} {cat.items.length === 1 ? 'alimento' : 'alimentos'}</span>
        <span className="fg-cat-arrow">{isOpen ? '▾' : '▸'}</span>
      </button>
      {isOpen && (
        <div className="fg-items">
          {cat.items.map(item => {
            const key = `${cat.id}-${item.name}`;
            const itemOpen = openItem === key;
            return (
              <ItemCard key={key} item={item} isOpen={itemOpen} onToggle={() => onToggleItem(key)} />
            );
          })}
        </div>
      )}
    </div>
  );
}

function ItemCard({ item, isOpen, onToggle }: { item: FoodItem; isOpen: boolean; onToggle: () => void }) {
  return (
    <div className={`fg-item${isOpen ? ' open' : ''}`}>
      <button className="fg-item-header" onClick={onToggle}>
        <span className="fg-item-name">{item.name}</span>
        <span className="fg-item-arrow">{isOpen ? '▾' : '▸'}</span>
      </button>
      {isOpen && (
        <div className="fg-item-body">
          {item.best.length > 0 && (
            <div className="fg-list fg-best">
              <span className="fg-list-label">✅ Mejor elección</span>
              <ul>{item.best.map((b, i) => <li key={i}>{b}</li>)}</ul>
            </div>
          )}
          {item.avoid.length > 0 && (
            <div className="fg-list fg-avoid">
              <span className="fg-list-label">⚠️ Evita o limita</span>
              <ul>{item.avoid.map((a, i) => <li key={i}>{a}</li>)}</ul>
            </div>
          )}
          {item.tip && (
            <div className="fg-tip">
              <span className="fg-tip-icon">💡</span>
              <span>{item.tip}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

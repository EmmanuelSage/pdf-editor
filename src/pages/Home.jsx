import { Link } from 'react-router-dom';

const TOOLS = [
  {
    to: '/edit',
    icon: '✏️',
    title: 'Edit document',
    description: 'Open a PDF, fill its form fields or add your own text anywhere, then download the edited copy.',
  },
  {
    to: '/images-to-pdf',
    icon: '🖼️',
    title: 'Images to PDF',
    description: 'Combine images into a single PDF — one image per page — and export it.',
  },
];

function ToolCard({ tool }) {
  const inner = (
    <>
      <span className="tool-card-icon" aria-hidden="true">{tool.icon}</span>
      <span className="tool-card-title">{tool.title}</span>
      <span className="tool-card-desc">{tool.description}</span>
      {tool.soon && <span className="tool-card-badge">Coming soon</span>}
    </>
  );

  if (tool.soon) {
    return <div className="tool-card disabled" aria-disabled="true">{inner}</div>;
  }
  return <Link to={tool.to} className="tool-card">{inner}</Link>;
}

export default function Home() {
  return (
    <div className="home">
      <header className="home-header">
        <span className="brand">PDF Toolkit</span>
      </header>
      <main className="home-main">
        <h1 className="home-title">What would you like to do?</h1>
        <p className="home-subtitle">Everything runs in your browser — your files never leave your device.</p>
        <div className="tool-grid">
          {TOOLS.map((tool) => (
            <ToolCard key={tool.title} tool={tool} />
          ))}
        </div>
      </main>
    </div>
  );
}

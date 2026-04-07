import type { Project } from '../types'

interface Props {
  projects: Project[]
  selectedId: string | null
  onSelect: (id: string) => void
}

export function ProjectList({ projects, selectedId, onSelect }: Props) {
  return (
    <div className="panel project-list">
      <div className="panel-header">PROJECTS</div>
      {projects.map((p) => (
        <div
          key={p.id}
          data-testid="project-item"
          data-selected={p.id === selectedId}
          className={`project-item ${p.id === selectedId ? 'selected' : ''}`}
          onClick={() => onSelect(p.id)}
        >
          <span className="project-name">{p.name}</span>
          <span className="session-count">{p.sessionCount}</span>
        </div>
      ))}
    </div>
  )
}

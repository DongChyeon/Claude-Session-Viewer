import type { Project } from '../types'

interface Props {
  projects: Project[]
  selectedId: string | null
  onSelect: (id: string) => void
  width?: number
}

export function ProjectList({ projects, selectedId, onSelect, width }: Props) {
  return (
    <div className="panel project-list" style={width !== undefined ? { width } : undefined}>
      <div className="panel-header">PROJECTS</div>
      {projects.map((p) => (
        <div
          key={p.id}
          data-testid="project-item"
          data-selected={p.id === selectedId}
          className={`project-item ${p.id === selectedId ? 'selected' : ''}`}
          onClick={() => onSelect(p.id)}
          title={p.name}
        >
          <span className="project-name">{p.name}</span>
          <span className="session-count">{p.sessionCount}</span>
        </div>
      ))}
    </div>
  )
}

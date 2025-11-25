# Lode Overview

A lode is a structured repository of project knowledge designed to provide rich context for AI coding sessions. The term comes from mining terminology, where a lode is a rich or abundant source of valuable resources.

## Terminology

- **The Lode**: The entire knowledge repository contained in the `~/lode/` directory
- **A Lode**: A single markdown document focusing on one specific topic or aspect
- **Lode Entry**: Another term for "a lode" - a focused documentation file

## Core Concepts

- **Purpose**: To maintain a consistent, accessible knowledge base that can be used to seed AI coding sessions with relevant context
- **Structure**: Organized in markdown files within the `~/lode/` directory
- **Content Types**: Contains system behaviors, design decisions, patterns, tutorials, and implementation details
- **Usage**: Files are referenced to provide context in AI coding sessions
- **Evolution**: Grows and adapts with the project, capturing new knowledge as it emerges

## Directory Structure

The lode's structure should reflect your project's specific needs, design decisions, and objectives. While the basic organization follows a common pattern, the actual content and structure should evolve with your project.

Basic structure:
```
~/lode/
    overview.md          # Project-wide overview (this file)
    summary.md          # Project summary and key concepts
    tmp/                # Temporary session context (gitignored)
    [project-specific]/ # Directories relevant to your project
        overview.md    # Topic area introduction
        [details].md   # Specific knowledge lodes
```

Example subdirectories (adapt based on project needs):
- Core concepts and architecture
- System components
- Implementation patterns
- Design decisions
- API documentation
- Operational procedures
- Project-specific domains

The structure should:
- Mirror your project's architecture and concerns
- Evolve as the project grows
- Capture knowledge where it emerges
- Support easy discovery and reference
- Adapt to changing project needs

## File Content Guidelines

Each lode (document) should:
- Focus on a single topic or concern
- Be self-contained but reference related lodes
- Include implementation patterns and preferences
- Document system behaviors and interfaces
- Capture design decisions and rationale
- Include tutorials for complex operations

## Creating New Lodes

When creating a new lode:
1. **Location**: Choose or create an appropriate directory based on your project's structure
2. **Naming**: Use clear, specific names with `.md` extension
3. **Structure**: Follow standard markdown formatting
4. **References**: Link to related lodes using relative paths
5. **Examples**: Include concrete implementation examples
6. **Context**: Explain how the topic fits into the broader project

## Usage Patterns

1. **Seeding Sessions**:
   - Tag relevant lodes at session start
   - Combine multiple lodes for complex context

2. **Maintenance**:
   - Update as new knowledge emerges
   - Create new lodes for new patterns/knowledge
   - Keep tmp/ for session-specific context
   - Restructure as project evolves

3. **Organization**:
   - Structure reflects project architecture
   - Keep files focused and modular
   - Include diagrams where helpful
   - Adapt organization to project needs

## Best Practices

- Create lodes through AI assistance
- Update regularly as system evolves
- Break down complex areas into focused lodes
- Maintain clear separation of concerns
- Focus on knowledge that aids code generation
- Let structure emerge from project needs

Remember: The lode is a living repository that grows and evolves with the project. Its structure and content should be shaped by your project's specific needs, design decisions, and objectives. Individual lodes provide focused documentation on specific aspects of the system, forming a comprehensive knowledge base that adapts as your project develops. 
# Claude Development Guidelines for Jarvis

This file contains system prompts, development guidelines, and project-specific instructions for working with the Jarvis AI investment agent codebase.

## 📋 System Prompt for Claude

When working on the Jarvis project, follow these guidelines:

### Package Management
- **ALWAYS use `bun` instead of `npm`** for all package management and script execution
- Run `bun run dev` for development server
- Run `bun run build` for production builds
- Run `bun run lint` for code linting
- Use `bun add` for installing dependencies
- Use `bun remove` for removing dependencies

### Development Workflow
1. **Always create feature branches** for new features:
   ```bash
   git checkout -b feat/feature-name
   ```
2. **Follow conventional commit messages**:
   ```
   feat: add new feature
   fix: resolve bug
   chore: update dependencies
   docs: update documentation
   ```
3. **Test before committing**:
   - Run `bun run lint` to check code quality
   - Run `bun run build` to ensure builds work
   - Test functionality manually when possible

### Code Quality Standards
- **TypeScript strict mode**: All new code must be properly typed
- **Component patterns**: Follow existing patterns in the codebase
- **Error handling**: Always implement proper error handling with try/catch
- **Loading states**: Use `DefaultSkeleton` for loading states
- **Responsive design**: Ensure components work on mobile and desktop

### File Organization Patterns

#### Tools (`/lib/tools/`)
```typescript
import { tool } from 'ai'
import { z } from 'zod'

export const toolName = tool({
  description: 'Clear description for AI',
  parameters: z.object({
    // zod validation schema
  }),
  execute: async (params, context) => {
    try {
      // Implementation
      return {
        _uiDisplayTool: true,
        summary: 'Human-readable summary',
        data: processedData
      }
    } catch (error) {
      return {
        _uiDisplayTool: true,
        summary: 'Error message',
        data: { error: error.message }
      }
    }
  }
})
```

#### API Integration (`/lib/[service-name]/`)
- `types.ts` - TypeScript interfaces
- `api.ts` - API functions with error handling
- `utils.ts` - Utility functions and formatters

#### UI Components (`/components/`)
- Follow existing naming conventions
- Use `CollapsibleMessage` for tool result displays
- Implement proper error states and loading states
- Use `ToolArgsSection` for tool headers

#### Component Template
```typescript
'use client'

import { CollapsibleMessage } from './collapsible-message'
import { DefaultSkeleton } from './default-skeleton'
import { ToolArgsSection } from './section'

interface ComponentProps {
  tool: any
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

export function Component({ tool, isOpen, onOpenChange }: ComponentProps) {
  if (tool.state === 'call') {
    return <DefaultSkeleton />
  }

  const toolResult = tool.result || {}
  const result = toolResult.data || toolResult || {}
  
  const header = (
    <ToolArgsSection tool="tool_name">
      Tool Display Name
    </ToolArgsSection>
  )

  if (result.error) {
    return (
      <CollapsibleMessage
        role="assistant"
        isCollapsible={true}
        header={header}
        isOpen={isOpen}
        onOpenChange={onOpenChange}
        showIcon={false}
      >
        <div className="p-4 text-red-600 dark:text-red-400">
          <div className="font-medium mb-2">Error message</div>
          <div className="text-sm">{result.error}</div>
        </div>
      </CollapsibleMessage>
    )
  }

  return (
    <CollapsibleMessage
      role="assistant"
      isCollapsible={true}
      header={header}
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      showIcon={false}
    >
      {/* Component content */}
    </CollapsibleMessage>
  )
}
```

### Tool Registration Process

1. **Create tool in `/lib/tools/`**
2. **Register in `/lib/utils/tool-registry.ts`**:
   ```typescript
   registry.registerTool({
     name: 'tool_name',
     description: 'Tool description',
     schema: toolName.parameters,
     execute: async (params, context) => toolName.execute(params, context),
     category: ToolCategory.WEB, // or WEB3, UTILITY
     supportedNetworks: ['ethereum', 'arbitrum', 'base'] // optional
   })
   ```
3. **Add UI component case in `/components/tool-section.tsx`**:
   ```typescript
   case 'tool_name':
     return (
       <ComponentName
         tool={tool}
         isOpen={isOpen}
         onOpenChange={onOpenChange}
       />
     )
   ```
4. **Add icon in `/components/tool-badge.tsx`**:
   ```typescript
   const icon: Record<string, React.ReactNode> = {
     tool_name: <IconName size={14} />,
   }
   ```

### API Routes (`/app/api/`)
- Follow Next.js App Router patterns
- Implement proper caching with `Cache-Control` headers
- Use consistent error response format:
  ```typescript
  return NextResponse.json(
    { success: false, error: 'Error message' },
    { status: 500 }
  )
  ```

### Styling Guidelines
- **Use Tailwind CSS** for all styling
- **Follow existing color schemes** and component patterns
- **Responsive design**: Test on mobile and desktop
- **Dark mode support**: Use appropriate dark mode classes
- **Accessibility**: Ensure proper contrast and keyboard navigation

### Testing Guidelines
- Test new features manually before committing
- Verify API integrations work with real data
- Check error handling scenarios
- Ensure responsive design works
- Test loading and error states

### Security Guidelines
- **IMPORTANT**: Only create defensive security tools
- Never create code that could be used maliciously
- Always validate and sanitize user inputs
- Use proper error handling to avoid information leakage
- Follow security best practices for API integrations

## 🛠 Common Commands

### Development
```bash
# Start development server
bun run dev

# Build for production
bun run build

# Run linter
bun run lint

# Type check
bunx tsc --noEmit
```

### Git Workflow
```bash
# Create feature branch
git checkout -b feat/feature-name

# Stage changes
git add .

# Commit with conventional message
git commit -m "feat: add new feature"

# Push feature branch
git push -u origin feat/feature-name
```

### Package Management
```bash
# Install dependencies
bun install

# Add new dependency
bun add package-name

# Add dev dependency
bun add -D package-name

# Remove dependency
bun remove package-name
```

## 📁 Project Structure

```
jarvis/
├── app/                     # Next.js App Router
│   ├── api/                # API routes
│   └── [pages]/            # App pages
├── components/             # React components
│   ├── ui/                # Base UI components
│   └── [feature-components]
├── lib/                   # Utilities and services
│   ├── [service-name]/    # Service-specific code
│   ├── tools/             # AI tools
│   ├── utils/             # Shared utilities
│   └── types/             # TypeScript types
├── public/                # Static assets
└── docs/                  # Documentation
```

## 🎯 Integration Patterns

### External API Integration
1. Create service directory in `/lib/[service-name]/`
2. Define TypeScript types
3. Implement API client with error handling
4. Create utility functions for data processing
5. Build AI tools that use the service
6. Create UI components for data display
7. Register tools and components

### UI Component Integration
1. Follow existing component patterns
2. Use `CollapsibleMessage` for tool results
3. Implement loading and error states
4. Add responsive design
5. Register in tool section switch statement

## 📚 Key Dependencies

- **Next.js 15** - React framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **AI SDK** - AI tool integration
- **Radix UI** - Base components
- **Lucide React** - Icons
- **Zod** - Schema validation

## 🚨 Important Notes

- **Always use `bun` instead of `npm`**
- **Create feature branches for all changes**
- **Test integrations before committing**
- **Follow existing patterns and conventions**
- **Implement proper error handling**
- **Use TypeScript strict mode**
- **Ensure responsive design**
- **Follow security best practices**

## 💡 Tips for Claude

1. **Read existing code patterns** before implementing new features
2. **Use the Task tool** for complex searches across the codebase
3. **Follow the TodoWrite/TodoRead pattern** for tracking progress
4. **Test API integrations** with curl or similar tools
5. **Verify file imports and exports** are correct
6. **Check that all required files are created**
7. **Ensure proper TypeScript typing throughout**
8. **Run linter and type check before finalizing**

---

*This document should be updated as the project evolves and new patterns emerge.*
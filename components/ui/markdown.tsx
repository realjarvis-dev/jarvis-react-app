import { FC, memo } from 'react';
import ReactMarkdown, { Options } from 'react-markdown';

interface MarkdownProps extends Options {
  className?: string;
}

export const MemoizedReactMarkdown: FC<MarkdownProps> = memo(
  ReactMarkdown as FC<MarkdownProps>,
  (prevProps, nextProps) =>
    prevProps.children === nextProps.children &&
    prevProps.className === nextProps.className
)

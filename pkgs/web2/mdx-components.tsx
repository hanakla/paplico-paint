import type { MDXComponents } from 'mdx/types'

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    ...components,
    h1: (props) => (
      <h1 className="text-4xl  font-sans font-semibold mb-8 " {...props} />
    ),
  }
}

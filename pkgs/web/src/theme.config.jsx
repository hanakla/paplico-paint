/** @satisfies {typeof import('nextra').} */
export default {
  logo: <span>Paplico</span>,
  project: {
    link: 'https://github.com/hanakla/paplico-paint',
  },
  footer: {
    component: null,
  },
  useNextSeoProps() {
    return {
      titleTemplate: '%s – Paplico',
    }
  },
}

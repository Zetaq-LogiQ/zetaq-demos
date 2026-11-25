// ZetaQ demo list. One entry per demo; files live in items/<slug>/index.html.
// hidden: true keeps an entry off the launcher (e.g. a demo still being built).
window.ZQ_GROUPS = [
  { id: 'lessons', name: 'Interactive Lessons' },
  { id: 'curiosity', name: 'Curiosity Hub' },
  { id: 'biology', name: 'Biology Models' },
  { id: 'physics', name: 'Physics Lab' },
  { id: 'chemistry', name: 'Chemistry Lab' },
  { id: 'space', name: 'Space' },
  { id: 'game', name: 'Game' }
];
window.ZQ_DEMOS = [
  { slug: 'square-cube', group: 'lessons', title: 'A Square and A Cube', chip: 'Class 8 · Maths', query: '?mode=preview' },
  { slug: 'heat-transfer', group: 'lessons', title: 'Heat on the Move', chip: 'Class 7 · Science', query: '?mode=preview' },

  { slug: 'harappa', group: 'curiosity', title: 'Harappa Explorer · Time Travel', chip: 'Class 6 · History' },

  { slug: 'plant-explorer', group: 'biology', title: 'Plant Explorer', chip: 'Biology · 3D' },
  { slug: 'cell-atlas', group: 'biology', title: 'Cell Atlas', chip: 'Biology · 3D' },
  { slug: 'plant-lab', group: 'biology', title: 'Plant Lab', chip: 'Class 7 · Science' },
  { slug: 'breathing-model', group: 'biology', title: 'Breathing Model', chip: 'Class 7 · Science' },

  { slug: 'optics-lab', group: 'physics', title: 'Optics Lab', chip: 'Physics · 3D', hidden: true },
  { slug: 'circuit', group: 'physics', title: 'Electric Circuit', chip: 'Class 7 · Science' },
  { slug: 'lemon-cell', group: 'physics', title: 'Lemon Cell and Dry Cell', chip: 'Class 8 · Science' },

  { slug: 'chem-lab', group: 'chemistry', title: 'Chemistry Lab', chip: 'Chemistry · 3D', hidden: true },
  { slug: 'changes-lab', group: 'chemistry', title: 'Changes Lab', chip: 'Class 7 · Science' },
  { slug: 'separation-lab', group: 'chemistry', title: 'Separation Lab', chip: 'Class 8 · Science' },

  { slug: 'solar-system', group: 'space', title: 'Solar System Explorer', chip: 'Space · 3D' },

  { slug: 'time-detective-ride', group: 'game', title: 'Time Detective Ride · True or False', chip: 'Class 6 · History' }
];

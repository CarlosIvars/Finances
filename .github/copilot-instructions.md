## Graphify

- usar `graphify query "<pregunta>"` primero para preguntas sobre arquitectura, estructura, componentes y ubicación o modificación de código cuando exista `graphify-out/graph.json`;
- usar `graphify path "<A>" "<B>"` para relaciones;
- usar `graphify explain "<concepto>"` para conceptos concretos;
- no versionar `graphify-out/`;
- pedir o ejecutar `graphify update .` cuando el grafo esté desactualizado.

Para navegación amplia, puede leer `graphify-out/wiki/index.md` si existe. Solo debe leer `graphify-out/GRAPH_REPORT.md` para revisiones amplias o cuando `query`, `path` y `explain` no aporten contexto suficiente.



## IMPORTANT
Cualquier cambio debe reflejarse tanto en la app móvil (Android) como en la app web (React + Django).
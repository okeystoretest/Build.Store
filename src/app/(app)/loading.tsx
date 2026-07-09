import { LoadingArea } from "@/components/ui/spinner";

/**
 * Fallback de carregamento entre rotas do app (troca de abas). O Next mostra
 * isto enquanto o segmento carrega, mascarando a transição.
 */
export default function AppLoading() {
  return <LoadingArea label="Carregando..." />;
}

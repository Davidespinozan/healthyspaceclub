interface ShareParams {
  cardElement: HTMLElement;
  milestoneDay: number;
  userName: string;
}

interface ShareResult {
  success: boolean;
  error?: string;
}

export async function shareMilestone(params: ShareParams): Promise<ShareResult> {
  try {
    const { toBlob } = await import('html-to-image');

    const blob = await toBlob(params.cardElement, {
      cacheBust: true,
      pixelRatio: 2,
      backgroundColor: '#F6F2EA',
    });

    if (!blob) {
      return { success: false, error: 'No se generó la imagen' };
    }

    const fileName = `hsc-logro-${params.milestoneDay}d-${Date.now()}.png`;
    const file = new File([blob], fileName, { type: 'image/png' });

    // Web Share API con archivos (iOS Safari 15+, Android Chrome)
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: `${params.milestoneDay} días en Healthy Space Club`,
          text: `Acabo de desbloquear ${params.milestoneDay} días de constancia.`,
        });
        return { success: true };
      } catch (e) {
        if ((e as Error).name === 'AbortError') return { success: true };
        throw e;
      }
    }

    // Fallback: descargar la imagen
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    return { success: true };
  } catch (error) {
    console.error('[shareMilestone]', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}

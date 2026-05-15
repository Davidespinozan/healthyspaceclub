import { useAppStore } from '../store';

export function openCoachWith(initialPrompt: string) {
  useAppStore.setState({
    coachPrefilledMessage: initialPrompt,
    coachOpen: true,
  });
}

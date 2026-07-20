import { of } from 'rxjs';
import { AllWorkComponent } from './all-work.component';

describe('AllWorkComponent', () => {
  it('should navigate to a user profile when invoked from a button click', () => {
    const router = {
      navigate: jasmine.createSpy('navigate')
    } as any;

    const component = new AllWorkComponent(
      {} as any,
      { getAccessToken: () => null, getUserIdFromToken: () => null } as any,
      router,
      { queryParams: of({}) } as any,
      { markForCheck: () => {} } as any,
      { getCurrentModal: () => null } as any
    );

    const event = {
      target: {
        closest: (selector: string) => selector === 'button'
      },
      currentTarget: {
        tagName: 'BUTTON'
      }
    } as unknown as Event;

    component.navigateToEntity('user', 42, event);

    expect(router.navigate).toHaveBeenCalledWith(['/user', 42]);
  });
});

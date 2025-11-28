import { Component } from '@angular/core';
import { DashboardPreview } from '../dashboard-preview/dashboard-preview';
import { Features } from '../features/features';
import { Footer } from '../footer/footer';
import { Hero } from '../hero/hero';
import { Testimonials } from '../testimonials/testimonials';
import { WhySection } from '../why-section/why-section';

@Component({
  selector: 'app-landing-page',
  imports: [ Hero,
    Features,
    WhySection,
    DashboardPreview,
    Testimonials,
    Footer],
  templateUrl: './landing-page.html',
  styleUrl: './landing-page.css'
})
export class LandingPage {

}

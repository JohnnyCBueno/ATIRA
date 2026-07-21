import { Platform } from 'react-native';

export const colours = {
  canvas: '#F4F0E8',
  surface: '#FFFDF8',
  surfaceMuted: '#EDE8DE',
  ink: '#17221F',
  inkSoft: '#66716C',
  line: '#DDD7CC',
  moss: '#176B5B',
  mossSoft: '#DCECE5',
  coral: '#E86F51',
  coralSoft: '#F8DFD6',
  amber: '#D59C35',
  amberSoft: '#F4E9C9',
  blue: '#4C748B',
  blueSoft: '#DCE9EE',
  white: '#FFFFFF',
};

export const radius = {
  small: 10,
  medium: 16,
  large: 24,
  pill: 999,
};

export const shadow = Platform.select({
  web: { boxShadow: '0 5px 16px rgba(23, 34, 31, 0.08)' },
  default: {
    shadowColor: '#17221F',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3,
  },
})!;

import { Directory, File, Paths } from 'expo-file-system';

const imageDirectory = new Directory(Paths.document, 'vehicle-images');

function ensureImageDirectory() {
  if (!imageDirectory.exists) {
    imageDirectory.create({ idempotent: true, intermediates: true });
  }
}

function getSafeExtension(source: File) {
  const extension = source.extension.toLowerCase();
  return /^\.[a-z0-9]{1,5}$/.test(extension) ? extension : '.jpg';
}

function isManagedImage(uri: string) {
  return uri.startsWith(imageDirectory.uri);
}

export const vehicleImageService = {
  async persist(sourceUri: string) {
    if (isManagedImage(sourceUri)) {
      return sourceUri;
    }

    ensureImageDirectory();

    const source = new File(sourceUri);
    const filename = `vehicle-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${getSafeExtension(source)}`;
    const destination = new File(imageDirectory, filename);

    await source.copy(destination);
    return destination.uri;
  },

  remove(uri: string | null | undefined) {
    if (!uri || !isManagedImage(uri)) {
      return;
    }

    const image = new File(uri);
    if (image.exists) {
      image.delete();
    }
  },
};


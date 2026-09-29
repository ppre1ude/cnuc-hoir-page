import Image from "next/image";
import type { ActivityPhoto } from "./activityPhotos";
import { Reveal } from "./Reveal";
import styles from "./ActivityGallery.module.css";

type ActivityGalleryProps = {
  photos: ActivityPhoto[];
};

export function ActivityGallery({ photos }: ActivityGalleryProps) {
  return (
    <div className={styles.gallery}>
      {photos.map((photo, index) => (
        <Reveal className={styles.photo} delayed={index % 2 === 1} key={photo.id}>
          <Image
            src={photo.src}
            alt={photo.alt}
            fill
            sizes="(max-width: 760px) 100vw, 64vw"
            style={{ objectPosition: photo.objectPosition }}
          />
        </Reveal>
      ))}
    </div>
  );
}

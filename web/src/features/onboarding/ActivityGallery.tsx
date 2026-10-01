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
            width={photo.width}
            height={photo.height}
            sizes="(max-width: 760px) calc(100vw - 40px), (max-width: 1280px) calc((100vw - 88px) / 2), 608px"
            style={{ objectPosition: photo.objectPosition }}
          />
        </Reveal>
      ))}
    </div>
  );
}
